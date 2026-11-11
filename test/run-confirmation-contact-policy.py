"""Native fixture runner: real UI/Nest/Python, disposable loopback PostgreSQL only.

Uses private dependencies already installed under /tmp. Never loads .env,
starts a WhatsApp sender or accesses a clinical service. Cleans up its services.
"""
import argparse
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--node', type=Path, required=True)
parser.add_argument('--python-root', type=Path, required=True)
parser.add_argument('--frontend-root', type=Path, required=True)
parser.add_argument('--dependency-root', type=Path, required=True)
parser.add_argument('--playwright-module', required=True)
args = parser.parse_args()
backend = Path(__file__).resolve().parents[1]
deps = args.dependency_root.resolve()
if not deps.is_relative_to('/tmp') or not (deps / '.prisma/client/schema.prisma').is_file():
    raise SystemExit('Private generated dependencies under /tmp are required')
if ''.join((deps / '.prisma/client/schema.prisma').read_text().split()) != ''.join((backend / 'prisma/schema.prisma').read_text().split()):
    raise SystemExit('Private Prisma client must match the current schema')
workspace = Path('/tmp/higia-admin-homolog-fixture')
if workspace.exists():
    raise SystemExit('Existing fixture session: inspect it before retrying')
for port in (5548, 3105, 8877, 5178):
    with socket.socket() as probe:
        probe.settimeout(0.5)
        if probe.connect_ex(('127.0.0.1', port)) == 0:
            raise SystemExit(f'Fixture port {port} is occupied')
workspace.mkdir(mode=0o700)
directory = Path(tempfile.mkdtemp(prefix='higia-contact-policy-'))
container = 'confirmation-contact-policy-' + uuid.uuid4().hex[:10]
started = False
processes = []
log = (directory / 'runtime.log').open('w')
env = {k: v for k, v in os.environ.items() if k in {'HOME', 'LANG', 'TMPDIR'}}
env.update(PATH=str(args.node.parent) + ':/usr/bin:/bin',
           PYTHON_DOTENV_DISABLED='1', DOTENV_CONFIG_PATH='/dev/null',
           PYTHONDONTWRITEBYTECODE='1', PYTHONPATH=str(args.python_root / 'src'),
           SAUDEVIANET_EMAIL='fixture@example.invalid', SAUDEVIANET_PASSWORD='fixture-only',
           DATABASE_URL='postgresql://fixture:fixture-only@127.0.0.1:5548/appointments_homolog_fixture',
           SAUDEVIANET_INTERNAL_API_BASE='http://127.0.0.1:8877',
           SAUDEVIANET_INTERNAL_API_TOKEN='fixture-only',
           PLAYWRIGHT_MODULE=args.playwright_module)


def run(command, cwd=directory):
    subprocess.run([str(x) for x in command], cwd=cwd, env=env,
                   stdout=log, stderr=log, check=True)


def start(command, cwd=directory):
    child = subprocess.Popen([str(x) for x in command], cwd=cwd, env=env,
                             stdout=log, stderr=log, start_new_session=True)
    processes.append(child)
    return child


def ready(port, child):
    for _ in range(120):
        if child.poll() is not None:
            raise RuntimeError('Fixture process exited')
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', port)) == 0:
                return
        time.sleep(0.25)
    raise RuntimeError('Fixture readiness timed out')


try:
    for name in ('src', 'prisma', 'test'):
        shutil.copytree(backend / name, directory / name)
    for name in ('package.json', 'prisma.config.ts', 'tsconfig.json', 'tsconfig.build.json'):
        shutil.copyfile(backend / name, directory / name)
    (directory / 'node_modules').symlink_to(deps, target_is_directory=True)
    run([args.node, 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json', '--incremental', 'false'])
    run(['docker', 'run', '--rm', '-d', '--name', container,
         '--label', 'confirmation.contact-policy=fixture-only',
         '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_USER=fixture',
         '-e', 'POSTGRES_PASSWORD=fixture-only', '-e', 'POSTGRES_DB=appointments_homolog_fixture',
         '-p', '127.0.0.1:5548:5432', 'postgres:16-alpine'])
    started = True
    for _ in range(60):
        if subprocess.run(['docker', 'exec', container, 'pg_isready', '-U', 'fixture'],
                          capture_output=True).returncode == 0:
            break
        time.sleep(0.25)
    else:
        raise RuntimeError('Disposable PostgreSQL unavailable')
    run([args.node, 'node_modules/prisma/build/index.js', 'migrate', 'deploy'])
    fixture = directory / 'test/confirmation-admin.homologation.cjs'
    fixture.write_text(fixture.read_text().replace("app.listen(3105, '0.0.0.0')", "app.listen(3105, '127.0.0.1')"))
    api = start([args.node, fixture])
    ready(3105, api)
    python = start([args.python_root / '.venv/bin/python', directory / 'test/confirmation-admin.classifier-fixture.py'])
    ready(8877, python)
    config = workspace / 'vite.config.mjs'
    import json
    config.write_text(
        "import {createRequire} from 'node:module';\n"
        f"const require=createRequire({json.dumps(str(args.frontend_root / 'package.json'))});\n"
        "const react=(await import(require.resolve('@vitejs/plugin-react'))).default;\n"
        f"export default {{root:{json.dumps(str(args.frontend_root))},envDir:false,plugins:[react()],"
        "server:{proxy:{'/api':{target:'http://127.0.0.1:3105',changeOrigin:true}}}};\n"
    )
    frontenv = dict(env, VITE_API_URL='/api')
    frontend = subprocess.Popen([str(args.node.parent / 'npm'), 'run', 'dev', '--', '--config', str(config),
                                 '--host', '127.0.0.1', '--port', '5178', '--strictPort'],
                                cwd=args.frontend_root, env=frontenv, stdout=log, stderr=log, start_new_session=True)
    processes.append(frontend)
    ready(5178, frontend)
    run([args.node, 'test/confirmation-admin.homologation.mjs'], args.frontend_root)
    print('PASS: authenticated UI -> Higia -> Python policy; private fixture data only', flush=True)
except Exception:
    log.flush()
    shutil.copyfile(directory / 'runtime.log', '/tmp/higia-contact-policy-integrated-failure.log')
    raise
finally:
    for child in reversed(processes):
        try:
            os.killpg(child.pid, signal.SIGTERM)
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
        except ProcessLookupError:
            pass
    if started:
        subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
    log.close()
    shutil.rmtree(directory)
    shutil.rmtree(workspace)
