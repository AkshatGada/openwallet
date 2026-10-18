import concurrent.futures
import json
import pathlib
import subprocess
import sys
import tempfile
import ows

if '--worker' in sys.argv:
    data = json.load(sys.stdin)
    try:
        result = ows.sign_message(data['wallet'], 'base', 'offline concurrency probe', data['token'], vault_path_opt=data['vault'])
    except Exception as exc:
        assert data['deny'] and 'Cumulative spending accounting unavailable' in str(exc)
    else:
        assert not data['deny'] and result['signature']
    print('ok', end='')
else:
    with tempfile.TemporaryDirectory(prefix='ows-python-spending-') as vault:
        wallet = ows.create_wallet('compatibility-only', vault_path_opt=vault)
        policy = pathlib.Path(vault) / 'availability-policy.py'
        policy.write_text(f'#!{sys.executable}\n' + '''
import json, sys
ctx = json.load(sys.stdin)
spending = ctx.get('spending')
if not isinstance(spending, dict) or 'daily_total' not in spending or spending['daily_total'] is not None or spending['date'] != ctx['timestamp'][:10]:
    json.dump({'allow': False, 'reason': 'Unexpected accounting context'}, sys.stdout)
else:
    json.dump({'allow': ctx['policy_config']['mode'] == 'allow', 'reason': 'Cumulative spending accounting unavailable'}, sys.stdout)
''')
        policy.chmod(0o700)
        keys = {}
        for mode in ('allow', 'deny'):
            ows.create_policy(json.dumps(dict(id=mode, name=mode, version=1, created_at='2026-03-22T00:00:00Z', rules=[], executable=str(policy), config={'mode':mode}, action='deny')), vault_path_opt=vault)
            keys[mode] = ows.create_api_key(mode, [wallet['id']], [mode], '', vault_path_opt=vault)
        token = keys['deny']['token']
        typed = json.dumps(dict(types={'EIP712Domain':[], 'Message':[]}, primaryType='Message', domain={}, message={}))
        operations = [
            lambda: ows.sign_transaction(wallet['id'], 'base', '00'*32, token, vault_path_opt=vault),
            lambda: ows.sign_message(wallet['id'], 'base', 'hello', token, vault_path_opt=vault),
            lambda: ows.sign_hash(wallet['id'], 'base', '00'*32, token, vault_path_opt=vault),
            lambda: ows.sign_typed_data(wallet['id'], 'base', typed, token, vault_path_opt=vault),
        ]
        for operation in operations:
            try:
                operation()
            except Exception as exc:
                assert 'Cumulative spending accounting unavailable' in str(exc)
            else:
                raise AssertionError('expected unavailable-accounting denial')
        def child(deny):
            data = dict(vault=vault, wallet=wallet['id'], token=keys['deny' if deny else 'allow']['token'], deny=deny)
            result = subprocess.run([sys.executable, __file__, '--worker'], input=json.dumps(data), capture_output=True, text=True)
            assert result.returncode == 0 and result.stdout == 'ok', result.stderr
        for batch in range(2):
            for deny in (False, True):
                with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                    list(pool.map(child, [deny]*4))
        try:
            int(None)
        except TypeError:
            pass
        else:
            raise AssertionError('null coercion changed')
        assert int(None or '0') == 0
        print('PASS: Python native null contract; 4 signing operations deny; 8 allowed signatures and 8 denials in fresh processes, 4 concurrent per batch; coercion caveat verified. No cumulative ledger claimed.')
