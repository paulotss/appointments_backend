"""Disposable PostgreSQL + real authenticated APIs + simulated legacy writes."""
import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--node', type=Path, required=True)
parser.add_argument('--python-root', type=Path, required=True)
parser.add_argument('--bridge-root', type=Path, required=True, help='agent-bridge directory')
parser.add_argument('--frontend-root', type=Path)
parser.add_argument('--playwright-module')
args = parser.parse_args()
backend = Path(__file__).resolve().parents[1]
for port in (5553, 3113, 8879, 5183):
    with socket.socket() as probe:
        probe.settimeout(0.2)
        if probe.connect_ex(('127.0.0.1', port)) == 0:
            raise SystemExit(f'Fixture port {port} occupied')
directory = Path(tempfile.mkdtemp(prefix='confirmation-legacy-'))
container = 'confirmation-legacy-fixture-' + uuid.uuid4().hex[:10]
started = False
processes = []
handles = []
env = {key: value for key, value in os.environ.items() if key in {'HOME', 'LANG', 'TMPDIR'}}
env.update(PATH=str(args.node.parent) + ':/usr/bin:/bin', PYTHON_DOTENV_DISABLED='1',
           SAUDEVIANET_EMAIL='fixture@example.invalid', SAUDEVIANET_PASSWORD='fixture-only',
           DOTENV_CONFIG_PATH='/dev/null', CONFIRMATION_LEGACY_FIXTURE='fixture-only',
           CONFIRMATION_LEGACY_DIRECTORY=str(directory),
           DATABASE_URL='postgresql://fixture:fixture-only@127.0.0.1:5553/confirmation_legacy_fixture')


def run(command, cwd=backend):
    result = subprocess.run([str(arg) for arg in command], cwd=cwd, env=env, capture_output=True, text=True)
    if result.returncode:
        # Every process sees only fixture credentials; retain a short diagnostic.
        diagnostic = result.stdout[-2000:] + result.stderr[-2000:]
        if (directory / 'python.log').exists():
            diagnostic += (directory / 'python.log').read_text()[-1000:]
        raise RuntimeError(diagnostic)


def start(command, name, cwd=backend):
    handle = (directory / (name + '.log')).open('w')
    handles.append(handle)
    process = subprocess.Popen([str(arg) for arg in command], cwd=cwd, env=env, stdout=handle, stderr=subprocess.STDOUT)
    processes.append(process)
    return process


def wait_port(port, process):
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError('Fixture exited: ' + ''.join(p.read_text()[-2000:] for p in directory.glob('*.log')))
        with socket.socket() as probe:
            probe.settimeout(0.2)
            if probe.connect_ex(('127.0.0.1', port)) == 0:
                return
        time.sleep(0.25)
    raise RuntimeError('Fixture readiness timed out')


try:
    shutil.copytree((backend / 'node_modules').resolve(), directory / 'node_modules', symlinks=True)
    shutil.copytree(backend / 'prisma', directory / 'prisma')
    shutil.copy(backend / 'prisma.config.ts', directory)
    shutil.copy(backend / 'package.json', directory)
    run([args.node, directory / 'node_modules/prisma/build/index.js', 'generate'], directory)
    run(['docker', 'run', '--rm', '-d', '--name', container, '--label', 'confirmation.legacy=fixture-only',
         '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_USER=fixture', '-e', 'POSTGRES_PASSWORD=fixture-only',
         '-e', 'POSTGRES_DB=confirmation_legacy_fixture', '-p', '127.0.0.1:5553:5432', 'postgres:16-alpine'])
    started = True
    for _ in range(60):
        if subprocess.run(['docker', 'exec', container, 'pg_isready', '-U', 'fixture'], capture_output=True).returncode == 0:
            break
        time.sleep(0.25)
    else:
        raise RuntimeError('Disposable database unavailable')
    run([args.node, directory / 'node_modules/prisma/build/index.js', 'migrate', 'deploy'], directory)
    run([args.node, backend / 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json', '--incremental', 'false', '--outDir', directory / 'dist'])
    python = args.python_root / '.venv/bin/python'
    process = start([python, args.python_root / 'scripts/confirmation_legacy_fixture.py', '--directory', directory], 'python')
    wait_port(8879, process)
    shutil.copy(backend / 'test/confirmation-legacy.fixture.cjs', directory / 'fixture.cjs')
    process = start([args.node, directory / 'fixture.cjs'], 'backend', directory)
    wait_port(3113, process)
    run([args.node, '--import', args.bridge_root / 'node_modules/tsx/dist/loader.mjs', '--test', args.bridge_root / 'src/confirmations/legacy.integration.test.ts'], args.bridge_root)
    print('PASS: authenticated reply -> Python -> simulated legacy write/reread -> Higia persistence; replay and service scopes', flush=True)
    if args.frontend_root:
        frontend = directory / 'frontend'
        frontend.mkdir()
        for item in ('src', 'public'):
            shutil.copytree(args.frontend_root / item, frontend / item)
        for item in ('index.html', 'package.json', 'vite.config.ts'):
            shutil.copy(args.frontend_root / item, frontend / item)
        (frontend / 'node_modules').symlink_to((args.frontend_root / 'node_modules').resolve(), target_is_directory=True)
        env['VITE_API_PROXY_TARGET'] = 'http://127.0.0.1:3113'
        env['VITE_API_URL'] = '/api'
        if args.playwright_module:
            env['PLAYWRIGHT_MODULE'] = args.playwright_module
        process = start([args.node, frontend / 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], 'frontend', frontend)
        wait_port(5183, process)
        run([args.node, args.frontend_root / 'test/confirmation-legacy.homologation.mjs'], args.frontend_root)
        print('PASS: browser distinguishes patient response and confirmed legacy status', flush=True)
finally:
    for process in reversed(processes):
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    for handle in handles:
        handle.close()
    if started:
        subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
    shutil.rmtree(directory)
