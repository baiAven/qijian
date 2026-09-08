'use client';
import { useRef, useState } from 'react';
import {
  Copy,
  Download,
  Upload,
  Network,
  HardDrive,
  Link,
  Unplug,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { LocalStore } from '@/lib/store';
export function SyncPanel({
  open,
  onClose,
  store,
}: {
  open: boolean;
  onClose: () => void;
  store?: LocalStore;
}) {
  const [useStun, setUseStun] = useState(false);
  const [role, setRole] = useState<'offer' | 'answer' | ''>('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  function download() {
    if (!store) return;
    const blob = new Blob([store.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `企见-备份-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setSuccess('已导出本地贡献；GitHub 来源资料与示例随应用内置，不重复导出。');
  }
  async function action(fn: () => Promise<void>) {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试。');
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    store?.disconnect();
    setRole('');
    setInput('');
    setOutput('');
    setError('');
    setSuccess('');
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="modal">
        <DialogTitle>把彼此的资料，连接起来。</DialogTitle>
        <DialogDescription>
          无需注册。与信任的设备交换全部本地贡献，合并后各自保存。
        </DialogDescription>
        <div className="sync-state">
          <Network size={25} color="#c23443" />
          <div>
            <strong>{store?.peerState || '正在打开本地资料'}</strong>
            <p>
              {store?.lastSync
                ? `上次合并：${store.lastSync}`
                : '同一浏览器的多个标签页会自动合并。'}
            </p>
          </div>
        </div>
        <div className="sync-method">
          <h3>
            设备直连 <span className="tag">一对一试验</span>
          </h3>
          <p>
            保持两台设备的页面打开。连接码含网络信息，请只交给你信任的人；连接后会合并全部资料。
          </p>
          <label className="switch-line">
            跨网络辅助（使用 Google STUN）
            <Switch
              checked={useStun}
              onCheckedChange={setUseStun}
              disabled={!!role || busy}
              aria-label="使用 STUN 辅助连接"
            />
          </label>
          <p>
            {useStun
              ? 'STUN 帮助发现公网地址，不保存榜单。未使用 TURN，部分移动网络仍可能失败。'
              : '默认不访问 STUN 服务，适合在同一局域网尝试；浏览器或路由器仍可能阻止连接。'}
          </p>
          {!role && (
            <div className="sync-actions">
              <button
                className="btn primary"
                disabled={!store || busy}
                onClick={() =>
                  action(async () => {
                    const peer = store!.connect(useStun);
                    setRole('offer');
                    setInput('');
                    setOutput(await peer.offer());
                  })
                }
              >
                <Link />
                {busy ? '正在生成…' : '我来发起连接'}
              </button>
              <button
                className="btn"
                disabled={!store || busy}
                onClick={() => {
                  setRole('answer');
                  setInput('');
                  setOutput('');
                }}
              >
                我收到邀请
              </button>
            </div>
          )}
          {role && (
            <div className="form-stack" style={{ marginTop: 16 }}>
              {role === 'offer' && output && (
                <>
                  <label className="field">
                    1. 将邀请连接码复制给对方
                    <textarea
                      className="sync-code"
                      value={output}
                      readOnly
                      aria-label="邀请连接码"
                    />
                  </label>
                  <button
                    className="btn"
                    onClick={() =>
                      action(async () => {
                        await navigator.clipboard.writeText(output);
                        setSuccess('邀请连接码已复制。');
                      })
                    }
                  >
                    <Copy />
                    复制邀请连接码
                  </button>
                </>
              )}
              <label className="field">
                {role === 'offer'
                  ? '2. 粘贴对方返回的回复连接码'
                  : '1. 粘贴对方发来的邀请连接码'}
                <textarea
                  className="sync-code"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="在这里粘贴完整连接码"
                  maxLength={30000}
                />
              </label>
              <button
                className="btn primary"
                disabled={
                  !store ||
                  busy ||
                  !input.trim() ||
                  (role === 'offer' && !output)
                }
                onClick={() =>
                  action(async () => {
                    if (role === 'offer') {
                      if (!store!.peer)
                        throw new Error('连接已关闭，请重新发起。');
                      await store!.peer.finish(input);
                      setSuccess(
                        '已提交回复码，正在尝试连接；若失败可使用下方文件合并。',
                      );
                    } else {
                      setOutput(await store!.connect(useStun).answer(input));
                      setSuccess('请把回复码发给邀请方，等待对方确认。');
                    }
                  })
                }
              >
                {busy
                  ? '正在处理…'
                  : role === 'offer'
                    ? '确认并连接'
                    : '生成回复连接码'}
              </button>
              {role === 'answer' && output && (
                <>
                  <label className="field">
                    2. 将回复连接码发回给邀请方
                    <textarea
                      className="sync-code"
                      value={output}
                      readOnly
                      aria-label="回复连接码"
                    />
                  </label>
                  <button
                    className="btn"
                    onClick={() =>
                      action(async () => {
                        await navigator.clipboard.writeText(output);
                        setSuccess('回复连接码已复制。');
                      })
                    }
                  >
                    <Copy />
                    复制回复连接码
                  </button>
                </>
              )}
              <button className="btn quiet" disabled={busy} onClick={reset}>
                <Unplug />
                断开 / 重新开始
              </button>
            </div>
          )}
        </div>
        <div className="sync-method">
          <h3>也可以，用文件合并</h3>
          <p>
            把备份文件交给对方导入；对方再导出一份给你。双方离线添加的条目会合并，同一记录重复导入不会重复出现。
          </p>
          <div className="sync-actions">
            <button className="btn" disabled={!store} onClick={download}>
              <Download />
              导出备份
            </button>
            <button
              className="btn"
              disabled={!store || busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              导入并合并
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void action(async () => {
                    if (file.size > 1500000)
                      throw new Error('请选择小于 1.5 MB 的企见备份文件。');
                    store!.import(await file.text());
                    setSuccess('资料已合并到本地副本，原有资料保留。');
                  });
                e.target.value = '';
              }}
            />
          </div>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {success && <output className="success-message">{success}</output>}
        <p className="subtle" style={{ fontSize: 12, display: 'flex', gap: 7 }}>
          <HardDrive size={16} />
          清除浏览器数据会移除本地副本，请定期导出。网页关闭后不会继续同步。当前尚无账户身份验证或公共审核。
        </p>
      </DialogContent>
    </Dialog>
  );
}
