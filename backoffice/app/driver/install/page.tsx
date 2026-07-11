export default function DriverInstallPage() {
  return (
    <div className="driver-auth-card android-card stack gap-4">
      <h1 className="driver-screen-title">安裝車手 Web App</h1>
      <div className="android-soft-panel stack gap-2">
        <strong>Android Chrome / Edge</strong>
        <div className="muted">1. 打開右上角瀏覽器選單</div>
        <div className="muted">2. 點選「安裝 App」或「加入主畫面」</div>
        <div className="muted">3. 安裝後請從主畫面圖示打開，會以獨立 App 模式顯示</div>
      </div>
      <div className="android-soft-panel stack gap-2">
        <strong>iPhone Safari</strong>
        <div className="muted">1. 點下方分享按鈕</div>
        <div className="muted">2. 選擇「加入主畫面」</div>
        <div className="muted">3. 從主畫面圖示打開，即可接近原生 App 體驗</div>
      </div>
      <div className="muted">若你是從已安裝圖示進入，正常情況下不應再看到一般瀏覽器的網址列。</div>
    </div>
  );
}
