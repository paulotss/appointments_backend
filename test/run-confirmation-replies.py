"""Real HTTP contract + optional browser checks using disposable fixture services."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time
import uuid

import httpx

parser = argparse.ArgumentParser()
parser.add_argument('--node', required=True, type=Path)
parser.add_argument('--dependency-container', default='appointments-api-dev')
parser.add_argument('--browser', action='store_true')
parser.add_argument('--playwright-module')
args = parser.parse_args()
backend = Path(__file__).resolve().parents[1]
bridge = backend.parents[1] / 'higia-chat' / 'agent-bridge'
frontend = backend.parent / 'appointments_frontend'
directory = Path('/tmp/higia-replies-fixture')
if directory.exists():
    raise SystemExit('Previous fixture directory exists; inspect it before retrying')
for port in (5551, 3111, 5181):
    with socket.socket() as probe:
        probe.settimeout(0.5)
        if probe.connect_ex(('127.0.0.1', port)) == 0:
            raise SystemExit(f'Fixture port {port} occupied')
directory.mkdir(mode=0o700)
tag = uuid.uuid4().hex[:10]
containers, processes = [], []
volume = 'appointments-replies-deps-' + tag
volume_created = False
env = {**os.environ, 'PATH': str(args.node.parent) + os.pathsep + os.environ.get('PATH', ''),
       'HIGIA_REPLIES_INTEGRATION': 'fixture-only'}
if args.playwright_module:
    env['PLAYWRIGHT_MODULE'] = args.playwright_module


def docker(*arguments):
    result = subprocess.run(['docker', *arguments], text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-2000:])
    return result.stdout


def ready(url):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            with httpx.Client(timeout=1, trust_env=False) as client:
                client.get(url)
            return
        except httpx.HTTPError:
            time.sleep(0.5)
    raise RuntimeError('Fixture unavailable: ' + url)


try:
    docker('volume', 'create', '--label', 'higia.replies=fixture-only', volume)
    volume_created = True
    docker('run', '--rm', '--volumes-from', args.dependency_container, '-v', f'{volume}:/fixture-deps',
           'appointments_backend-app', 'sh', '-c',
           'cp -a node_modules/. /fixture-deps/ && chown -R 1000:1000 /fixture-deps')
    docker('run', '--rm', '--user', '1000:1000', '--volumes-from', args.dependency_container,
           '-v', f'{volume}:/app/node_modules', '-e', 'DOTENV_CONFIG_PATH=/dev/null',
           '-e', 'DATABASE_URL=postgresql://fixture:fixture-only@127.0.0.1:5551/confirmation_replies_fixture',
           'appointments_backend-app', 'node_modules/.bin/prisma', 'generate')
    db = 'appointments-replies-fixture-db-' + tag
    docker('run', '--rm', '-d', '--name', db, '--label', 'higia.replies=fixture-only',
           '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_USER=fixture', '-e', 'POSTGRES_PASSWORD=fixture-only',
           '-e', 'POSTGRES_DB=confirmation_replies_fixture', '-p', '127.0.0.1:5551:5432', 'postgres:16-alpine')
    containers.append(db)
    for _ in range(60):
        result = subprocess.run(['docker', 'exec', db, 'pg_isready', '-U', 'fixture'], capture_output=True)
        if result.returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise RuntimeError('Fixture PostgreSQL unavailable')
    docker('run', '--rm', '--network', 'host', '--user', '1000:1000', '--volumes-from', args.dependency_container,
           '-v', f'{volume}:/app/node_modules',
           '-e', 'DOTENV_CONFIG_PATH=/dev/null',
           '-e', 'DATABASE_URL=postgresql://fixture:fixture-only@127.0.0.1:5551/confirmation_replies_fixture',
           'appointments_backend-app', 'node_modules/.bin/prisma', 'migrate', 'deploy')
    print('Migrations applied only to disposable replies database', flush=True)
    api = 'appointments-replies-fixture-api-' + tag
    docker('run', '-d', '--name', api, '--label', 'higia.replies=fixture-only', '--user', '1000:1000',
           '--volumes-from', args.dependency_container, '-v', f'{volume}:/app/node_modules',
           '--tmpfs', '/app/dist:rw,mode=1777', '-v', f'{directory}:{directory}', '-p', '127.0.0.1:3111:3111',
           '-e', 'DATABASE_URL=postgresql://fixture:fixture-only@host.docker.internal:5551/confirmation_replies_fixture',
           'appointments_backend-app', 'sh', '-c',
           'node_modules/.bin/tsc -p tsconfig.build.json --incremental false && node test/confirmation-replies.fixture.cjs')
    containers.append(api)
    try:
        ready('http://127.0.0.1:3111/api/confirmation-campaigns')
    except RuntimeError:
        print(docker('logs', api))
        raise
    subprocess.run([str(args.node), '--import', 'tsx', '--test', 'src/confirmations/higiaReplies.integration.test.ts'],
                   cwd=bridge, env=env, check=True)
    if args.browser:
        browser_env = {key: value for key, value in env.items() if not key.startswith('VITE_')}
        browser_env['VITE_API_URL'] = '/api'
        # Do not load the frontend's local .env or use its configured API target.
        config = directory / 'vite.config.mjs'
        config.write_text(
            "import { createRequire } from 'node:module';\n"
            f"const require = createRequire({json.dumps(str(frontend / 'package.json'))});\n"
            "const react = (await import(require.resolve('@vitejs/plugin-react'))).default;\n"
            f"export default {{ root: {json.dumps(str(frontend))}, envDir: false, plugins: [react()], "
            "server: { proxy: { '/api': { target: 'http://127.0.0.1:3111', changeOrigin: true } } } };\n"
        )
        output = (directory / 'vite.log').open('w')
        try:
            process = subprocess.Popen([str(args.node.parent / 'npm'), 'run', 'dev', '--', '--config', str(config), '--host', '127.0.0.1',
                                        '--port', '5181', '--strictPort'], cwd=frontend, env=browser_env,
                                       stdout=output, stderr=output, start_new_session=True)
            processes.append(process)
            ready('http://127.0.0.1:5181/')
            subprocess.run([str(args.node), 'test/confirmation-replies.homologation.mjs'], cwd=frontend, env=env, check=True)
        finally:
            output.close()
finally:
    cleanup_errors = []
    for process in reversed(processes):
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        except ProcessLookupError:
            pass
    for name in reversed(containers):
        present = subprocess.run(['docker', 'container', 'inspect', name], capture_output=True)
        if present.returncode == 0:
            try:
                docker('stop', name)
                if name.startswith('appointments-replies-fixture-api-'):
                    docker('rm', name)
            except RuntimeError:
                cleanup_errors.append(name)
    if volume_created:
        try:
            docker('volume', 'rm', volume)
        except RuntimeError:
            cleanup_errors.append(volume)
    shutil.rmtree(directory)
    if cleanup_errors:
        raise RuntimeError('Fixture cleanup incomplete: ' + ', '.join(cleanup_errors))
    print('Disposable replies containers, dependencies and session removed', flush=True)
