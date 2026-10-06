"""Evaluation-only JSON-RPC client. Runs owned fixtures, never a production adapter."""
import asyncio
import json
import pathlib
import sys


async def evaluate(config):
    log = []
    diagnostics = {}
    pending = {}
    sequence = 0
    proc = await asyncio.create_subprocess_exec(*config['command'], cwd=config['root'], stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)

    async def send(message):
        data = json.dumps(message).encode()
        proc.stdin.write(('Content-Length: %d\r\n\r\n' % len(data)).encode() + data)
        await proc.stdin.drain()

    async def read():
        while True:
            header = await proc.stdout.readuntil(b'\r\n\r\n')
            size = int(next(line.split(b':')[1] for line in header.split(b'\r\n') if line.lower().startswith(b'content-length:')))
            message = json.loads(await proc.stdout.readexactly(size))
            if 'method' in message:
                log.append(message)
                if message['method'] == 'textDocument/publishDiagnostics':
                    diagnostics[message['params']['uri']] = message['params']
                if 'id' in message:
                    result = [config['settings'] for _ in message['params'].get('items', [])] if message['method'] == 'workspace/configuration' else None
                    await send({'jsonrpc': '2.0', 'id': message['id'], 'result': result})
            elif message.get('id') in pending:
                pending.pop(message['id']).set_result(message)

    async def request(method, params, timeout=120):
        nonlocal sequence
        sequence += 1
        future = asyncio.get_running_loop().create_future()
        pending[sequence] = future
        await send({'jsonrpc': '2.0', 'id': sequence, 'method': method, 'params': params})
        response = await asyncio.wait_for(future, timeout)
        if 'error' in response:
            raise RuntimeError(json.dumps(response['error']))
        return response.get('result')

    async def notify(method, params):
        await send({'jsonrpc': '2.0', 'method': method, 'params': params})

    async def diagnostic(uri, predicate):
        for _ in range(100):
            value = diagnostics.get(uri)
            if value is not None and predicate(value):
                return value
            await asyncio.sleep(.1)
        return {'state': 'unavailable', 'last': diagnostics.get(uri)}

    reader = asyncio.create_task(read())
    stderr = asyncio.create_task(proc.stderr.read())
    result = {'root': config['root'], 'cases': []}
    try:
        root = pathlib.Path(config['root']).as_uri()
        result['initialize'] = await request('initialize', {
            'processId': None, 'rootUri': root, 'workspaceFolders': [{'uri': root, 'name': 'm503'}],
            'capabilities': {'textDocument': {'completion': {'completionItem': {'snippetSupport': True}}, 'publishDiagnostics': {'versionSupport': True}}, 'workspace': {'configuration': True}},
            'initializationOptions': {'settings': config['settings'], 'extendedClientCapabilities': {'classFileContentsSupport': True}},
        })
        await notify('initialized', {})
        for _ in range(600):
            if any(item['method'] == 'language/status' and item['params'].get('type') == 'ServiceReady' for item in log):
                break
            await asyncio.sleep(.1)
        else:
            raise RuntimeError('JDT LS did not report ServiceReady')
        for case in config['cases']:
            uri = pathlib.Path(case['path']).as_uri()
            text = pathlib.Path(case['path']).read_text()
            await notify('textDocument/didOpen', {'textDocument': {'uri': uri, 'languageId': 'java', 'version': 1, 'text': text}})
            valid = await diagnostic(uri, lambda value: True)
            line = next(index for index, value in enumerate(text.splitlines()) if case['use'] in value)
            character = text.splitlines()[line].index(case['use'])
            definition = await request('textDocument/definition', {'textDocument': {'uri': uri}, 'position': {'line': line, 'character': character + 1}})
            completion_text, cline, col = completion_edit(text, case['member'], case['prefix'])
            diagnostics.pop(uri, None)
            await notify('textDocument/didChange', {'textDocument': {'uri': uri, 'version': 2}, 'contentChanges': [{'text': completion_text}]})
            completion = await request('textDocument/completion', {'textDocument': {'uri': uri}, 'position': {'line': cline, 'character': col}})
            diagnostics.pop(uri, None)
            broken = text.replace(case['member'], 'missingM503Symbol', 1)
            await notify('textDocument/didChange', {'textDocument': {'uri': uri, 'version': 3}, 'contentChanges': [{'text': broken}]})
            invalid = await diagnostic(uri, lambda value: any('missingM503Symbol' in item['message'] for item in value['diagnostics']))
            result['cases'].append({'name': case['name'], 'valid': valid, 'definition': definition, 'completion': completion, 'invalid': invalid})
            await notify('textDocument/didClose', {'textDocument': {'uri': uri}})
        await request('shutdown', {}, 10)
        await notify('exit', {})
        await asyncio.wait_for(proc.wait(), 10)
    finally:
        if proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), 5)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
        reader.cancel()
        result['notifications'] = log
        try:
            result['stderr'] = (await asyncio.wait_for(stderr, 1)).decode(errors='replace')
        except asyncio.TimeoutError:
            result['stderr'] = 'Detached Gradle daemon retained stderr; caller must stop the owned Gradle user home.'
        pathlib.Path(config['output']).write_text(json.dumps(result, indent=2))


def completion_edit(text, member, length):
    offset = text.index(member)
    edited = text[:offset] + member[:length] + text[offset + len(member):]
    before = text[:offset]
    return edited, before.count('\n'), len(before.rsplit('\n', 1)[-1]) + length


if __name__ == '__main__':
    asyncio.run(evaluate(json.loads(pathlib.Path(sys.argv[1]).read_text())))
