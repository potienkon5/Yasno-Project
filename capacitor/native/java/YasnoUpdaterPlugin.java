package kz.yasno.classroom;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "YasnoUpdater")
public class YasnoUpdaterPlugin extends Plugin {
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final Handler ui = new Handler(Looper.getMainLooper());
  private static final long MAX_APK_BYTES = 250L * 1024 * 1024;

  @PluginMethod
  public void getVersion(PluginCall call) {
    try {
      PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
      JSObject result = new JSObject();
      result.put("versionName", info.versionName);
      result.put("versionCode", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
      result.put("packageName", getContext().getPackageName());
      call.resolve(result);
    } catch (Exception ex) { call.reject("Не удалось прочитать версию: " + ex.getMessage()); }
  }

  @PluginMethod
  public void downloadAndInstall(PluginCall call) {
    String assetUrl = call.getString("url", "");
    String expectedHash = call.getString("sha256", "").toLowerCase(Locale.ROOT);
    if (!assetUrl.startsWith("https://github.com/") || !assetUrl.contains("/releases/download/")) {
      call.reject("Разрешены только APK из GitHub Releases по HTTPS"); return;
    }
    if (!expectedHash.matches("[0-9a-f]{64}")) {
      call.reject("Отсутствует SHA-256 релизного APK; загрузка остановлена"); return;
    }
    if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + getContext().getPackageName()));
      settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(settings);
      call.reject("Разрешите «Установка неизвестных приложений» для Ясно, затем повторите обновление");
      return;
    }
    executor.execute(() -> {
      File file = null;
      HttpURLConnection connection = null;
      try {
        File folder = new File(getContext().getCacheDir(), "updates");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("Не удалось создать каталог загрузки");
        file = new File(folder, "yasno-update.apk");
        if (file.exists()) file.delete();
        URL url = new URL(assetUrl);
        int redirects = 0;
        while (true) {
          connection = (HttpURLConnection) url.openConnection();
          connection.setInstanceFollowRedirects(false);
          connection.setConnectTimeout(15000);
          connection.setReadTimeout(30000);
          connection.setRequestProperty("User-Agent", "Yasno-Android-Updater");
          int status = connection.getResponseCode();
          if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
            if (++redirects > 8) throw new Exception("Слишком много перенаправлений");
            URL next = new URL(url, connection.getHeaderField("Location"));
            String host = next.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equals(next.getProtocol()) || !(host.equals("github.com") || host.endsWith(".githubusercontent.com") || host.equals("release-assets.githubusercontent.com")))
              throw new Exception("Недопустимый сервер загрузки");
            connection.disconnect(); connection = null; url = next; continue;
          }
          if (status != 200) throw new Exception("GitHub вернул HTTP " + status);
          break;
        }
        long size = connection.getContentLengthLong();
        if (size > MAX_APK_BYTES) throw new Exception("APK больше 250 МБ");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long downloaded = 0; int previousPercent = -1;
        try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(file)) {
          byte[] buffer = new byte[65536]; int count;
          while ((count = in.read(buffer)) != -1) {
            downloaded += count;
            if (downloaded > MAX_APK_BYTES) throw new Exception("APK превышает лимит размера");
            digest.update(buffer, 0, count); out.write(buffer, 0, count);
            int percent = size > 0 ? (int)Math.min(100, downloaded * 100 / size) : -1;
            if (percent != previousPercent && (percent % 5 == 0 || percent == 100)) {
              previousPercent = percent;
              JSObject progress = new JSObject(); progress.put("percent", percent);
              progress.put("downloadedBytes", downloaded);
              notifyListeners("progress", progress);
            }
          }
        }
        StringBuilder actual = new StringBuilder();
        for (byte b : digest.digest()) actual.append(String.format(Locale.ROOT, "%02x", b & 255));
        if (!expectedHash.equals(actual.toString())) throw new Exception("Контрольная сумма APK не совпадает");
        PackageInfo apk = getContext().getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), 0);
        if (apk == null || !getContext().getPackageName().equals(apk.packageName))
          throw new Exception("APK принадлежит другому приложению");
        PackageInfo current = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        long newCode = Build.VERSION.SDK_INT >= 28 ? apk.getLongVersionCode() : apk.versionCode;
        long currentCode = Build.VERSION.SDK_INT >= 28 ? current.getLongVersionCode() : current.versionCode;
        if (newCode <= currentCode) throw new Exception("versionCode новой сборки должен быть больше текущего");
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updateprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ui.post(() -> {
          try {
            getContext().startActivity(intent);
            JSObject result = new JSObject(); result.put("installerOpened", true);
            call.resolve(result);
          } catch (Exception ex) { call.reject("Не удалось открыть установщик: " + ex.getMessage()); }
        });
      } catch (Exception ex) {
        if (file != null && file.exists()) file.delete();
        call.reject("Ошибка обновления: " + ex.getMessage());
      } finally { if (connection != null) connection.disconnect(); }
    });
  }
}
