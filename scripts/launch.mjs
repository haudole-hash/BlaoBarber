/**
 * Khởi động BLaoBarber: mở trình duyệt, chạy server nếu chưa chạy.
 * Dùng cho shortcut / file .bat trên máy tiệm.
 */
import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3847;
const appUrl = `http://127.0.0.1:${PORT}`;

process.chdir(root);

if (!existsSync(join(root, "dist", "index.html"))) {
  console.error("Thiếu thư mục dist/. Chạy: npm run build");
  process.exit(1);
}

async function isServerUp() {
  try {
    const res = await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function openBrowser() {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", appUrl], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [appUrl], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [appUrl], { detached: true, stdio: "ignore" }).unref();
  }
}

if (await isServerUp()) {
  console.log("Ứng dụng đang chạy — mở trình duyệt...");
  openBrowser();
  process.exit(0);
}

console.log("Đang khởi động BLaoBarber...");
console.log("Đóng cửa sổ này sẽ tắt phần mềm.\n");

const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  cwd: root,
  env: { ...process.env, BLAO_AUTO_OPEN: "1", PORT: String(PORT) },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
