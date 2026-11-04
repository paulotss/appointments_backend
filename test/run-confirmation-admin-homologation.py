"""Run real UI + Nest + Prisma + Python classification against a disposable DB.

Run with the saudevianet project's venv Python. Requires Docker, Node, the local
development images/dependency volume and Playwright/Chromium already installed.
Never loads .env, queries the legacy system or starts the dispatcher.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid

import httpx

parser = argparse.ArgumentParser()
parser.add_argument('--node', required=True, type=Path)
parser.add_argument('--dependency-container', default='appointments-api-dev')
parser.add_argument('--playwright-module')
parser.add_argument('--backend-checks', action='store_true')
args = parser.parse_args()
backend = Path(__file__).resolve().parents[1]
frontend = backend.parent / 'appointments_frontend'
workspace = Path('/tmp/higia-admin-homolog-fixture')
if workspace.exists():
    raise SystemExit('Fixture workspace already exists; inspect and clean the previous run first')
for port in (5548, 3105, 8877, 5178):
    with socket.socket() as probe:
        probe.settimeout(0.5)
        if probe.connect_ex(('127.0.0.1', port)) == 0:
            raise SystemExit(f'Fixture port {port} is already in use')
workspace.mkdir(mode=0o700)
suffix = uuid.uuid4().hex[:10]
db_name = 'appointments-admin-homolog-db-' + suffix
api_name = 'appointments-admin-homolog-api-' + suffix
processes = []
containers = []
volume = 'appointments-admin-homolog-deps-' + suffix
volume_created = False
log = (workspace / 'runtime.log').open('w')
env = {**os.environ, 'PYTHON_DOTENV_DISABLED': '1', 'SAUDEVIANET_EMAIL': 'fixture@example.invalid',
       'SAUDEVIANET_PASSWORD': 'fixture-only', 'PATH': str(args.node.parent) + os.pathsep + os.environ.get('PATH', '')}
if args.playwright_module:
    env['PLAYWRIGHT_MODULE'] = args.playwright_module


def command(argv, **kwargs):
    return subprocess.run(argv, check=True, stdout=log, stderr=log, **kwargs)


def docker(*argv):
    command(['docker', *argv])


def start(argv, **kwargs):
    process = subprocess.Popen(argv, stdout=log, stderr=log, env=env, start_new_session=True, **kwargs)
    processes.append(process)


def ready(url, seconds=60):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with httpx.Client(timeout=1, trust_env=False) as client:
                client.get(url)
            return
        except httpx.HTTPError:
            time.sleep(0.5)
    raise RuntimeError('Fixture service did not become ready: ' + url)


try:
    docker('volume', 'create', '--label', 'higia.homologation=fixture-only', volume)
    volume_created = True
    docker('run', '--rm', '--volumes-from', args.dependency_container, '-v', f'{volume}:/fixture-deps',
           'appointments_backend-app', 'sh', '-c',
           'cp -a node_modules/. /fixture-deps/ && chown -R 1000:1000 /fixture-deps')
    docker('run', '--rm', '--user', '1000:1000', '--volumes-from', args.dependency_container,
           '-v', f'{volume}:/app/node_modules', '-e', 'DOTENV_CONFIG_PATH=/dev/null',
           '-e', 'DATABASE_URL=postgresql://fixture:fixture-only@127.0.0.1:5548/appointments_homolog_fixture',
           'appointments_backend-app', 'node_modules/.bin/prisma', 'generate')
    if args.backend_checks:
        docker('run', '--rm', '--user', '1000:1000', '--volumes-from', args.dependency_container,
               '-v', f'{volume}:/app/node_modules', 'appointments_backend-app', 'sh', '-c',
               'npm test -- --runInBand confirmation-admin.service.spec.ts appointment-source.spec.ts confirmation-simulation.service.spec.ts && node_modules/.bin/tsc --noEmit --incremental false -p tsconfig.build.json')
        print('Backend administrative/simulation tests and typecheck passed', flush=True)
    docker('run', '--rm', '-d', '--name', db_name, '--label', 'higia.homologation=fixture-only',
           '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_USER=fixture',
           '-e', 'POSTGRES_PASSWORD=fixture-only', '-e', 'POSTGRES_DB=appointments_homolog_fixture',
           '-p', '127.0.0.1:5548:5432', 'postgres:16-alpine')
    containers.append(db_name)
    for _ in range(60):
        result = subprocess.run(['docker', 'exec', db_name, 'pg_isready', '-U', 'fixture'], stdout=log, stderr=log)
        if result.returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise RuntimeError('Disposable PostgreSQL did not become ready')
    docker('run', '--rm', '--network', 'host', '--user', '1000:1000',
           '--volumes-from', args.dependency_container,
           '-v', f'{volume}:/app/node_modules', '-e', 'DOTENV_CONFIG_PATH=/dev/null',
           '-e', 'DATABASE_URL=postgresql://fixture:fixture-only@127.0.0.1:5548/appointments_homolog_fixture',
           'appointments_backend-app', 'node_modules/.bin/prisma', 'migrate', 'deploy')
    docker('run', '--rm', '-d', '--name', api_name, '--label', 'higia.homologation=fixture-only',
           '--user', '1000:1000', '--volumes-from', args.dependency_container,
           '-v', f'{volume}:/app/node_modules',
           '--tmpfs', '/app/dist:rw,mode=1777', '-v', f'{workspace}:{workspace}',
           '-p', '127.0.0.1:3105:3105',
           '-e', 'DATABASE_URL=postgresql://fixture:fixture-only@host.docker.internal:5548/appointments_homolog_fixture',
           '-e', 'SAUDEVIANET_INTERNAL_API_BASE=http://host.docker.internal:8877',
           '-e', 'SAUDEVIANET_INTERNAL_API_TOKEN=fixture-only', 'appointments_backend-app',
           'sh', '-c', 'node_modules/.bin/tsc -p tsconfig.build.json --incremental false && node test/confirmation-admin.homologation.cjs')
    containers.append(api_name)
    ready('http://127.0.0.1:3105/api/confirmation-campaigns')
    start([sys.executable, str(backend / 'test/confirmation-admin.classifier-fixture.py')])
    ready('http://127.0.0.1:8877/')
    frontend_env = {key: value for key, value in env.items() if not key.startswith('VITE_')}
    frontend_env['VITE_API_URL'] = '/api'
    config = workspace / 'vite.config.mjs'
    config.write_text(
        "import { createRequire } from 'node:module';\n"
        f"const require = createRequire({json.dumps(str(frontend / 'package.json'))});\n"
        "const react = (await import(require.resolve('@vitejs/plugin-react'))).default;\n"
        f"export default {{ root: {json.dumps(str(frontend))}, envDir: false, plugins: [react()], "
        "server: { proxy: { '/api': { target: 'http://127.0.0.1:3105', changeOrigin: true } } } };\n"
    )
    process = subprocess.Popen([str(args.node.parent / 'npm'), 'run', 'dev', '--', '--config', str(config), '--host', '127.0.0.1',
                                '--port', '5178', '--strictPort'], cwd=frontend, env=frontend_env, stdout=log, stderr=log, start_new_session=True)
    processes.append(process)
    ready('http://127.0.0.1:5178/')
    print('Disposable services ready; running administrative browser homologation', flush=True)
    subprocess.run([str(args.node), 'test/confirmation-admin.homologation.mjs'], cwd=frontend, env=env, check=True)
except Exception:
    # Only synthetic service diagnostics; never print the session file or tokens.
    log.flush()
    shutil.copyfile(workspace / 'runtime.log', '/tmp/higia-admin-homologation-runtime.log')
    raise
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
    for container in reversed(containers):
        present = subprocess.run(['docker', 'container', 'inspect', container], capture_output=True)
        if present.returncode == 0:
            result = subprocess.run(['docker', 'stop', container], stdout=log, stderr=log)
            if result.returncode:
                cleanup_errors.append(container)
    if volume_created:
        result = subprocess.run(['docker', 'volume', 'rm', volume], stdout=log, stderr=log)
        if result.returncode:
            cleanup_errors.append(volume)
    log.close()
    shutil.rmtree(workspace)
    if cleanup_errors:
        raise RuntimeError('Fixture cleanup incomplete: ' + ', '.join(cleanup_errors))
    print('Disposable containers, dependencies and fixture sessions removed', flush=True)
