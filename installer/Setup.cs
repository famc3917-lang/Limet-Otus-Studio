// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
//
// Limet Otus Studio installer and uninstaller (WPF, .NET Framework 4.8, C# 5).
// Built by installer/build-installer.ps1, which compiles this file with the generated SetupConfig.cs
// and appends the application as a ZIP payload followed by a 16-byte footer ("LIMETPK1" + length).
// Installs for the current user only; no administrator rights are required.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using Microsoft.Win32;

// Targeting 4.8 turns on the current path handling, so paths longer than 260 characters work with the \\?\ prefix below.
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]

namespace LimetOtus.Setup
{
    /// <summary>Extended-length paths: the application contains deep folders, and install locations vary.</summary>
    static class LongPath
    {
        public static string Of(string path)
        {
            string full = System.IO.Path.GetFullPath(path);
            if (full.StartsWith(@"\\?\")) return full;
            if (full.StartsWith(@"\\")) return @"\\?\UNC\" + full.Substring(2);
            return @"\\?\" + full;
        }
    }

    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            bool uninstall = args.Any(a => a.Equals("/uninstall", StringComparison.OrdinalIgnoreCase)) || !Payload.Present();
            bool silent = args.Any(a => a.Equals("/S", StringComparison.Ordinal));
            string from = args.Where(a => a.StartsWith("/from=", StringComparison.OrdinalIgnoreCase)).Select(a => a.Substring(6)).FirstOrDefault();
            string dir = args.Where(a => a.StartsWith("/dir=", StringComparison.OrdinalIgnoreCase)).Select(a => a.Substring(5).Trim('"')).FirstOrDefault();
            if (uninstall && from == null && Installer.RunningFromInstallDir())
            {
                // An uninstaller cannot delete its own folder; continue from a temporary copy.
                string copy = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "LimetOtusStudio-uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
                File.Copy(Installer.SelfPath(), copy);
                Process.Start(copy, "/uninstall /from=\"" + Installer.InstallDir() + "\"" + (silent ? " /S" : ""));
                return 0;
            }
            if (silent)
            {
                try
                {
                    if (uninstall) Installer.Uninstall(from ?? Installer.InstallDir(), null);
                    else Installer.Install(dir ?? Installer.InstallDir(), null);
                    return 0;
                }
                catch (Exception) { return 1; }
            }
            var app = new Application();
            app.ShutdownMode = ShutdownMode.OnMainWindowClose;
            var window = new SetupWindow(uninstall, from ?? dir);
            return app.Run(window);
        }
    }

    /// <summary>Reads the ZIP appended to this executable.</summary>
    static class Payload
    {
        const string Magic = "LIMETPK1";
        static long offset = -1, length = -1;

        static void Locate()
        {
            if (offset >= 0) return;
            using (var file = File.OpenRead(Installer.SelfPath()))
            {
                if (file.Length < 16) { offset = 0; length = 0; return; }
                file.Seek(-16, SeekOrigin.End);
                var footer = new byte[16];
                file.Read(footer, 0, 16);
                if (Encoding.ASCII.GetString(footer, 0, 8) != Magic) { offset = 0; length = 0; return; }
                length = BitConverter.ToInt64(footer, 8);
                offset = file.Length - 16 - length;
            }
        }
        public static bool Present() { Locate(); return length > 0; }
        public static long StubLength() { Locate(); return length > 0 ? offset : new FileInfo(Installer.SelfPath()).Length; }
        public static ZipArchive Open()
        {
            Locate();
            var file = File.OpenRead(Installer.SelfPath());
            return new ZipArchive(new SubStream(file, offset, length), ZipArchiveMode.Read, false);
        }
    }

    sealed class SubStream : Stream
    {
        readonly Stream inner; readonly long start, size; long position;
        public SubStream(Stream inner, long start, long size) { this.inner = inner; this.start = start; this.size = size; }
        public override bool CanRead { get { return true; } }
        public override bool CanSeek { get { return true; } }
        public override bool CanWrite { get { return false; } }
        public override long Length { get { return size; } }
        public override long Position { get { return position; } set { position = value; } }
        public override int Read(byte[] buffer, int offset, int count)
        {
            long left = size - position; if (left <= 0) return 0;
            if (count > left) count = (int)left;
            inner.Position = start + position;
            int read = inner.Read(buffer, offset, count); position += read; return read;
        }
        public override long Seek(long value, SeekOrigin origin)
        {
            if (origin == SeekOrigin.Begin) position = value; else if (origin == SeekOrigin.Current) position += value; else position = size + value;
            return position;
        }
        public override void Flush() { }
        public override void SetLength(long value) { throw new NotSupportedException(); }
        public override void Write(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }
        protected override void Dispose(bool disposing) { if (disposing) inner.Dispose(); base.Dispose(disposing); }
    }

    /// <summary>Progress reported to the interface: fraction 0..1 and a short status line.</summary>
    delegate void Progress(double fraction, string status);

    static class Installer
    {
        const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + SetupConfig.RegistryName;

        public static string SelfPath() { return Process.GetCurrentProcess().MainModule.FileName; }
        public static string DefaultDir() { return System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", SetupConfig.FolderName); }
        public static string InstallDir()
        {
            using (var key = Registry.CurrentUser.OpenSubKey(UninstallKey))
            {
                var location = key == null ? null : key.GetValue("InstallLocation") as string;
                return string.IsNullOrEmpty(location) ? DefaultDir() : location;
            }
        }
        public static bool RunningFromInstallDir()
        {
            string dir = System.IO.Path.GetDirectoryName(SelfPath());
            return string.Equals(dir.TrimEnd('\\'), InstallDir().TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
        }
        public static bool ExistingInstall() { return File.Exists(System.IO.Path.Combine(InstallDir(), SetupConfig.ExeName)); }

        public static long RequiredBytes()
        {
            using (var zip = Payload.Open()) return zip.Entries.Sum(e => e.Length);
        }

        /// <summary>Closes the application if it is running from the target folder.</summary>
        public static void CloseRunning(string dir)
        {
            string prefix = dir.TrimEnd('\\') + "\\";
            foreach (var p in Process.GetProcesses())
            {
                string file = null;
                try { file = p.MainModule.FileName; } catch (Exception) { }
                if (file == null || !file.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) || p.Id == Process.GetCurrentProcess().Id) continue;
                try { p.CloseMainWindow(); if (!p.WaitForExit(5000)) { p.Kill(); p.WaitForExit(5000); } } catch (Exception) { }
            }
        }

        public static void Install(string dir, Progress progress)
        {
            dir = System.IO.Path.GetFullPath(dir);
            if (progress != null) progress(0, Text.Pair("正在关闭运行中的程序", "Closing the running app"));
            CloseRunning(dir);
            // Replace an earlier version completely; studio data lives in the user profile, not here.
            if (Directory.Exists(dir) && File.Exists(System.IO.Path.Combine(dir, SetupConfig.ExeName)))
            {
                if (progress != null) progress(0, Text.Pair("正在移除旧版本", "Removing the previous version"));
                DeleteContents(LongPath.Of(dir));
            }
            Directory.CreateDirectory(LongPath.Of(dir));
            string root = dir.TrimEnd('\\') + "\\";
            long total;
            using (var zip = Payload.Open())
            {
                var entries = zip.Entries;
                total = Math.Max(1, entries.Sum(e => e.Length));
                long done = 0;
                int index = 0;
                foreach (var entry in entries)
                {
                    index++;
                    string target = System.IO.Path.GetFullPath(System.IO.Path.Combine(dir, entry.FullName));
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Unsafe path in package: " + entry.FullName);
                    if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\")) { Directory.CreateDirectory(LongPath.Of(target)); continue; }
                    Directory.CreateDirectory(LongPath.Of(System.IO.Path.GetDirectoryName(target)));
                    entry.ExtractToFile(LongPath.Of(target), true);
                    done += entry.Length;
                    if (progress != null && (index % 20 == 0 || index == entries.Count))
                        progress(0.96 * done / total, Text.Pair("正在解压", "Extracting") + "  " + index + " / " + entries.Count);
                }
            }
            if (progress != null) progress(0.97, Text.Pair("正在创建快捷方式", "Creating shortcuts"));
            WriteUninstaller(dir);
            string exe = System.IO.Path.Combine(dir, SetupConfig.ExeName);
            Shortcut.Create(StartMenuLink(), exe, dir);
            Shortcut.Create(DesktopLink(), exe, dir);
            Register(dir, total);
            if (progress != null) progress(1, Text.Pair("安装完成", "Installation complete"));
        }

        public static void Uninstall(string dir, Progress progress)
        {
            if (progress != null) progress(0.05, Text.Pair("正在关闭运行中的程序", "Closing the running app"));
            CloseRunning(dir);
            if (progress != null) progress(0.2, Text.Pair("正在删除快捷方式", "Removing shortcuts"));
            foreach (var link in new[] { StartMenuLink(), DesktopLink() }) { try { if (File.Exists(link)) File.Delete(link); } catch (Exception) { } }
            if (progress != null) progress(0.35, Text.Pair("正在删除程序文件", "Removing program files"));
            if (Directory.Exists(dir) && File.Exists(System.IO.Path.Combine(dir, SetupConfig.ExeName))) { DeleteContents(LongPath.Of(dir)); try { Directory.Delete(LongPath.Of(dir), false); } catch (Exception) { } }
            Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
            if (progress != null) progress(1, Text.Pair("卸载完成", "Uninstall complete"));
            ScheduleSelfDelete();
        }

        static void DeleteContents(string dir)
        {
            foreach (var file in Directory.GetFiles(dir)) { File.SetAttributes(file, FileAttributes.Normal); File.Delete(file); }
            foreach (var sub in Directory.GetDirectories(dir)) { DeleteContents(sub); Directory.Delete(sub, false); }
        }

        static void WriteUninstaller(string dir)
        {
            long stub = Payload.StubLength();
            using (var source = File.OpenRead(SelfPath()))
            using (var target = File.Create(System.IO.Path.Combine(dir, "Uninstall.exe")))
            {
                var buffer = new byte[81920]; long left = stub;
                while (left > 0) { int read = source.Read(buffer, 0, (int)Math.Min(buffer.Length, left)); if (read <= 0) break; target.Write(buffer, 0, read); left -= read; }
            }
        }

        static void Register(string dir, long bytes)
        {
            using (var key = Registry.CurrentUser.CreateSubKey(UninstallKey))
            {
                string uninstaller = System.IO.Path.Combine(dir, "Uninstall.exe");
                key.SetValue("DisplayName", SetupConfig.DisplayName);
                key.SetValue("DisplayVersion", SetupConfig.Version);
                key.SetValue("Publisher", SetupConfig.Publisher);
                key.SetValue("DisplayIcon", System.IO.Path.Combine(dir, SetupConfig.ExeName) + ",0");
                key.SetValue("InstallLocation", dir);
                key.SetValue("UninstallString", "\"" + uninstaller + "\" /uninstall");
                key.SetValue("QuietUninstallString", "\"" + uninstaller + "\" /uninstall /S");
                key.SetValue("EstimatedSize", (int)(bytes / 1024), RegistryValueKind.DWord);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
            }
        }

        static string StartMenuLink() { return System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), SetupConfig.ShortcutName + ".lnk"); }
        static string DesktopLink() { return System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), SetupConfig.ShortcutName + ".lnk"); }

        static void ScheduleSelfDelete()
        {
            string self = SelfPath();
            if (!self.StartsWith(System.IO.Path.GetTempPath(), StringComparison.OrdinalIgnoreCase)) return;
            var info = new ProcessStartInfo("cmd.exe", "/c ping 127.0.0.1 -n 3 > nul & del /f /q \"" + self + "\"");
            info.CreateNoWindow = true; info.UseShellExecute = false;
            try { Process.Start(info); } catch (Exception) { }
        }

        public static void Launch(string dir)
        {
            try { Process.Start(new ProcessStartInfo(System.IO.Path.Combine(dir, SetupConfig.ExeName)) { WorkingDirectory = dir, UseShellExecute = true }); } catch (Exception) { }
        }
    }

    /// <summary>Shell links with the application's AppUserModelID, so taskbar grouping and notifications match the app.</summary>
    static class Shortcut
    {
        [ComImport, Guid("00021401-0000-0000-C000-000000000046")] class ShellLink { }
        [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
        interface IShellLinkW
        {
            void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder file, int max, IntPtr data, int flags);
            void GetIDList(out IntPtr list); void SetIDList(IntPtr list);
            void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder name, int max);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string name);
            void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder dir, int max);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string dir);
            void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder args, int max);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string args);
            void GetHotkey(out short key); void SetHotkey(short key);
            void GetShowCmd(out int cmd); void SetShowCmd(int cmd);
            void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int max, out int index);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, int reserved);
            void Resolve(IntPtr hwnd, int flags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string file);
        }
        [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
        interface IPropertyStore
        {
            void GetCount(out uint count); void GetAt(uint index, out PropertyKey key);
            void GetValue(ref PropertyKey key, out PropVariant value);
            void SetValue(ref PropertyKey key, ref PropVariant value); void Commit();
        }
        [StructLayout(LayoutKind.Sequential, Pack = 4)] struct PropertyKey { public Guid Format; public uint Id; }
        [StructLayout(LayoutKind.Explicit)] struct PropVariant { [FieldOffset(0)] public ushort Type; [FieldOffset(8)] public IntPtr Value; }
        [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
        interface IPersistFile
        {
            void GetClassID(out Guid id); [PreserveSig] int IsDirty();
            void Load([MarshalAs(UnmanagedType.LPWStr)] string file, int mode);
            void Save([MarshalAs(UnmanagedType.LPWStr)] string file, bool remember);
            void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string file); void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string file);
        }

        public static void Create(string link, string target, string dir)
        {
            var shell = (IShellLinkW)new ShellLink();
            shell.SetPath(target); shell.SetWorkingDirectory(dir); shell.SetIconLocation(target, 0); shell.SetDescription(SetupConfig.DisplayName);
            var store = (IPropertyStore)shell;
            var key = new PropertyKey { Format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), Id = 5 }; // System.AppUserModel.ID
            var value = new PropVariant { Type = 31, Value = Marshal.StringToCoTaskMemUni(SetupConfig.AppUserModelId) }; // VT_LPWSTR
            store.SetValue(ref key, ref value); store.Commit();
            Marshal.FreeCoTaskMem(value.Value);
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(link));
            ((IPersistFile)shell).Save(link, true);
        }
    }

    static class Text
    {
        public static string Pair(string zh, string en) { return zh + "  " + en; }
        public static readonly string[][] Lines = new[]
        {
            new[] { "In a vast world driven by AI, multimodal models draw more attention every day.", "在这个由 AI 驱动的庞大世界里，多模态模型越来越引人注目。" },
            new[] { "Many photographers have begun to wonder whether they will be replaced.", "许多摄影师开始担心，自己是否会被替代。" },
            new[] { "But photography is an art.", "但摄影是一门艺术。" },
            new[] { "What decides whether photographers still have a place in this world is whether you keep pressing the shutter.", "真正决定摄影师是否还存在于这个世界上的，是你是否还在继续按下快门。" },
            new[] { "Light, time and people meet only when you are there.", "光、时间与人，只有在你在场时才会相遇。" },
            new[] { "Dwell in one corner; see every scene.", "栖一隅，观万象。" },
        };
    }

    /// <summary>The window: International Typographic Style, dark paper, one red square, a rule and a numbered index.</summary>
    sealed class SetupWindow : Window
    {
        static readonly Brush Paper = Hex("#111111"), Ink = Hex("#F4F2EE"), Mute = Hex("#8E8E8E"), Faint = Hex("#3A3A3A"), Red = Hex("#E2231A");
        static readonly FontFamily Display = new FontFamily("Arial, Microsoft YaHei UI");
        const double W = 1080, H = 620, M = 64;

        readonly bool uninstall; readonly string from;
        readonly Grid page = new Grid();
        readonly StackPanel actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Center };
        readonly TextBlock[] stepNumbers = new TextBlock[4], stepLabels = new TextBlock[4];
        readonly Rectangle progressBar = new Rectangle { Height = 2, Fill = Red, HorizontalAlignment = HorizontalAlignment.Left, Width = 0 };
        Action primary;
        bool busy;
        string targetDir;
        CancellationTokenSource lines;

        static Brush Hex(string value) { var b = (SolidColorBrush)new BrushConverter().ConvertFromString(value); b.Freeze(); return b; }

        public SetupWindow(bool uninstall, string from)
        {
            this.uninstall = uninstall; this.from = from;
            targetDir = from ?? Installer.InstallDir();
            Title = SetupConfig.DisplayName + (uninstall ? " · 卸载 Uninstall" : " · 安装 Setup");
            Width = W; Height = H; ResizeMode = ResizeMode.CanMinimize; WindowStyle = WindowStyle.None; WindowStartupLocation = WindowStartupLocation.CenterScreen;
            Background = Paper; FontFamily = Display; Foreground = Ink; UseLayoutRounding = true; SnapsToDevicePixels = true;
            TextOptions.SetTextFormattingMode(this, TextFormattingMode.Ideal);
            try { Icon = System.Windows.Interop.Imaging.CreateBitmapSourceFromHIcon(System.Drawing.Icon.ExtractAssociatedIcon(Installer.SelfPath()).Handle, Int32Rect.Empty, System.Windows.Media.Imaging.BitmapSizeOptions.FromEmptyOptions()); } catch (Exception) { }
            SourceInitialized += delegate { RoundCorners(); };
            MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e) { if (e.ButtonState == MouseButtonState.Pressed) try { DragMove(); } catch (Exception) { } };
            KeyDown += delegate(object s, KeyEventArgs e) { if (e.Key == Key.Enter && primary != null && !busy) primary(); if (e.Key == Key.Escape && !busy) Close(); };
            Closing += delegate(object s, System.ComponentModel.CancelEventArgs e) { if (busy) e.Cancel = true; };
            Content = Frame();
            if (uninstall) ShowUninstallConfirm(); else ShowWelcome();
        }

        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
        void RoundCorners() { int round = 2; try { DwmSetWindowAttribute(new WindowInteropHelper(this).Handle, 33, ref round, 4); } catch (Exception) { } }

        UIElement Frame()
        {
            var root = new Canvas { Width = W, Height = H };
            var mark = new TextBlock { Text = Spaced("LIMET OTUS") + "  —  " + Spaced(SetupConfig.Version), FontSize = 13, Foreground = Mute };
            Place(root, mark, M, 52);
            Place(root, new Rectangle { Width = 56, Height = 56, Fill = Red }, W - M - 56, 48);
            var controls = new StackPanel { Orientation = Orientation.Horizontal };
            controls.Children.Add(WindowButton("—", delegate { WindowState = WindowState.Minimized; }));
            controls.Children.Add(WindowButton("×", delegate { if (!busy) Close(); }));
            Place(root, controls, W - M - 56 - 92, 44);
            Place(root, page, M, 116); page.Width = W - 2 * M; page.Height = H - 116 - 128;
            Place(root, new Rectangle { Width = W - 2 * M, Height = 2, Fill = Faint }, M, H - 112);
            progressBar.Width = 0; Place(root, progressBar, M, H - 112);
            var steps = new StackPanel { Orientation = Orientation.Horizontal };
            string[][] names = uninstall
                ? new[] { new[] { "确认", "Confirm" }, new[] { "卸载", "Remove" }, new[] { "完成", "Done" } }
                : new[] { new[] { "欢迎", "Welcome" }, new[] { "位置", "Location" }, new[] { "安装", "Install" }, new[] { "完成", "Done" } };
            for (int i = 0; i < names.Length; i++)
            {
                var cell = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 30, 0) };
                stepNumbers[i] = new TextBlock { Text = (i + 1).ToString("00"), FontSize = 14, FontWeight = FontWeights.Bold, Foreground = Mute, Margin = new Thickness(0, 0, 10, 0) };
                stepLabels[i] = new TextBlock { Text = names[i][0] + " " + names[i][1], FontSize = 14, Foreground = Mute };
                cell.Children.Add(stepNumbers[i]); cell.Children.Add(stepLabels[i]);
                steps.Children.Add(cell);
            }
            Place(root, steps, M, H - 76);
            var actionsHost = new Grid { Width = 440 }; actionsHost.Children.Add(actions); Place(root, actionsHost, W - M - 440, H - 90);
            return root;
        }

        static void Place(Canvas canvas, UIElement element, double x, double y) { Canvas.SetLeft(element, x); Canvas.SetTop(element, y); canvas.Children.Add(element); }
        static string Spaced(string text) { return string.Join(" ", text.Select(c => c.ToString()).ToArray()); }

        UIElement WindowButton(string glyph, Action click)
        {
            var label = new TextBlock { Text = glyph, FontSize = 16, Foreground = Mute, Width = 36, Height = 32, TextAlignment = TextAlignment.Center, Padding = new Thickness(0, 6, 0, 0), Background = Brushes.Transparent, Cursor = Cursors.Hand };
            label.MouseEnter += delegate { label.Foreground = Ink; };
            label.MouseLeave += delegate { label.Foreground = Mute; };
            label.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e) { e.Handled = true; };
            label.MouseLeftButtonUp += delegate { click(); };
            return label;
        }

        UIElement ActionButton(string zh, string en, bool main, Action click)
        {
            var text = new TextBlock { Text = zh + "   " + en, FontSize = 15, FontWeight = main ? FontWeights.Bold : FontWeights.Normal, Foreground = main ? Brushes.White : Mute, VerticalAlignment = VerticalAlignment.Center };
            var box = new Border { Child = text, Padding = main ? new Thickness(28, 14, 28, 14) : new Thickness(16, 14, 16, 14), Background = main ? Red : Brushes.Transparent, Cursor = Cursors.Hand, Margin = new Thickness(12, 0, 0, 0) };
            box.MouseEnter += delegate { if (main) box.Background = Hex("#F2392F"); else text.Foreground = Ink; };
            box.MouseLeave += delegate { if (main) box.Background = Red; else text.Foreground = Mute; };
            box.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e) { e.Handled = true; };
            box.MouseLeftButtonUp += delegate { if (!busy) click(); };
            return box;
        }

        void Actions(UIElement[] buttons, Action enter)
        {
            actions.Children.Clear();
            foreach (var b in buttons) if (b != null) actions.Children.Add(b);
            primary = enter;
        }

        void Step(int index)
        {
            for (int i = 0; i < stepNumbers.Length; i++)
            {
                if (stepNumbers[i] == null) continue;
                stepNumbers[i].Foreground = i == index ? Red : (i < index ? Ink : Mute);
                stepLabels[i].Foreground = i <= index ? Ink : Mute;
            }
        }

        /// <summary>Swaps the page content with a short fade and rise.</summary>
        void Show(UIElement content)
        {
            page.Children.Clear(); page.Children.Add(content);
            var move = new TranslateTransform(0, 14); content.RenderTransform = move; content.Opacity = 0;
            var ease = new CubicEase { EasingMode = EasingMode.EaseOut };
            content.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(320)) { EasingFunction = ease });
            move.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(14, 0, TimeSpan.FromMilliseconds(320)) { EasingFunction = ease });
        }

        static TextBlock Big(string text, double size) { return new TextBlock { Text = text, FontSize = size, FontWeight = FontWeights.Bold, LineHeight = size * 0.98, LineStackingStrategy = LineStackingStrategy.BlockLineHeight, Foreground = Ink }; }
        static TextBlock Body(string text, double size, Brush color) { return new TextBlock { Text = text, FontSize = size, Foreground = color, TextWrapping = TextWrapping.Wrap, LineHeight = size * 1.5, LineStackingStrategy = LineStackingStrategy.BlockLineHeight }; }

        Grid Columns(UIElement left, UIElement right)
        {
            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(660) });
            grid.ColumnDefinitions.Add(new ColumnDefinition());
            Grid.SetColumn(left, 0); Grid.SetColumn(right, 1);
            grid.Children.Add(left); grid.Children.Add(right);
            return grid;
        }

        StackPanel RightColumn(string zh, params UIElement[] rest)
        {
            var column = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom, Margin = new Thickness(0, 0, 0, 8) };
            column.Children.Add(new TextBlock { Text = zh, FontSize = 34, FontWeight = FontWeights.Bold, Foreground = Ink, Margin = new Thickness(0, 0, 0, 14) });
            foreach (var item in rest) column.Children.Add(item);
            return column;
        }

        // ------------------------------------------------------------------ install pages
        void ShowWelcome()
        {
            Step(0);
            var title = Big("Limet Otus\nStudio", 104); title.VerticalAlignment = VerticalAlignment.Bottom;
            string note = Installer.ExistingInstall()
                ? "已安装旧版本，将就地升级；工作室数据不受影响。\nAn earlier version will be upgraded in place; studio data is kept."
                : "为当前用户安装，不需要管理员权限。\nInstalls for the current user; no administrator rights needed.";
            Show(Columns(title, RightColumn("观隅鸮馆",
                Body("Business workspace for photographers", 16, Mute),
                Body("摄影工作室业务管理", 16, Mute),
                new Rectangle { Height = 24 },
                Body(note, 14, Mute))));
            Actions(new[] { ActionButton("退出", "Quit", false, Close), ActionButton("下一步", "Next", true, ShowLocation) }, ShowLocation);
        }

        void ShowLocation()
        {
            Step(1);
            var left = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom };
            left.Children.Add(Big("安装位置", 64));
            left.Children.Add(new TextBlock { Text = "Install location", FontSize = 30, FontWeight = FontWeights.Bold, Foreground = Mute, Margin = new Thickness(0, 6, 0, 0) });
            var path = new TextBox { Text = targetDir, FontSize = 15, Foreground = Ink, Background = Brushes.Transparent, BorderBrush = Ink, BorderThickness = new Thickness(0, 0, 0, 2), CaretBrush = Ink, Padding = new Thickness(0, 6, 0, 8), FontFamily = new FontFamily("Consolas, Microsoft YaHei UI") };
            path.TextChanged += delegate { targetDir = path.Text; };
            long need = 0; try { need = Installer.RequiredBytes(); } catch (Exception) { }
            Func<string> space = delegate
            {
                try { var drive = new DriveInfo(System.IO.Path.GetPathRoot(System.IO.Path.GetFullPath(targetDir))); return string.Format("需要 Required  {0:0.0} GB      可用 Available  {1:0.0} GB", need / 1073741824.0, drive.AvailableFreeSpace / 1073741824.0); }
                catch (Exception) { return string.Format("需要 Required  {0:0.0} GB", need / 1073741824.0); }
            };
            var info = Body(space(), 13, Mute); info.Margin = new Thickness(0, 14, 0, 0);
            path.TextChanged += delegate { info.Text = space(); };
            var browse = ActionButton("浏览", "Browse", false, delegate
            {
                using (var dialog = new System.Windows.Forms.FolderBrowserDialog { SelectedPath = Directory.Exists(targetDir) ? targetDir : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), ShowNewFolderButton = true })
                    if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK) path.Text = System.IO.Path.Combine(dialog.SelectedPath, SetupConfig.FolderName);
            });
            var right = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom, Margin = new Thickness(0, 0, 0, 8) };
            right.Children.Add(path); right.Children.Add(info);
            var row = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(-12, 18, 0, 0) }; row.Children.Add(browse);
            right.Children.Add(row);
            Show(Columns(left, right));
            Actions(new[] { ActionButton("上一步", "Back", false, ShowWelcome), ActionButton("安装", "Install", true, StartInstall) }, StartInstall);
        }

        void StartInstall()
        {
            try { targetDir = System.IO.Path.GetFullPath(targetDir.Trim()); }
            catch (Exception) { ShowError("安装位置无效。", "The install location is not valid.", ShowLocation); return; }
            Step(2); busy = true;
            var percent = Big("0%", 112); percent.VerticalAlignment = VerticalAlignment.Bottom;
            var status = Body(Text.Pair("准备中", "Preparing"), 13, Mute); status.Margin = new Thickness(0, 18, 0, 0);
            var line = Body("", 20, Ink); line.Opacity = 0; line.MinHeight = 64;
            var right = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom, Margin = new Thickness(0, 0, 0, 8) };
            right.Children.Add(line); right.Children.Add(status);
            var left = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom };
            left.Children.Add(new TextBlock { Text = "正在安装  Installing", FontSize = 18, FontWeight = FontWeights.Bold, Foreground = Mute, Margin = new Thickness(0, 0, 0, 4) });
            left.Children.Add(percent);
            Show(Columns(left, right));
            Actions(new UIElement[0], null);
            CycleLines(line);
            string dir = targetDir;
            Task.Factory.StartNew(delegate
            {
                Installer.Install(dir, delegate(double fraction, string text)
                {
                    Dispatcher.BeginInvoke(new Action(delegate { SetProgress(fraction); percent.Text = Math.Round(fraction * 100) + "%"; status.Text = text; }));
                });
            }).ContinueWith(delegate(Task task)
            {
                Dispatcher.BeginInvoke(new Action(delegate
                {
                    busy = false; StopLines();
                    if (task.IsFaulted) ShowError("安装未完成。", "Installation did not finish.", StartInstall, task.Exception.GetBaseException().Message);
                    else ShowDone();
                }));
            });
        }

        void ShowDone()
        {
            Step(3); SetProgress(1);
            bool launch = true;
            var title = Big("完成\nDone", 112); title.VerticalAlignment = VerticalAlignment.Bottom;
            var box = new Rectangle { Width = 18, Height = 18, Fill = Red, Stroke = Red, StrokeThickness = 2, Margin = new Thickness(0, 0, 12, 0), VerticalAlignment = VerticalAlignment.Center };
            var toggle = new StackPanel { Orientation = Orientation.Horizontal, Cursor = Cursors.Hand, Background = Brushes.Transparent, Margin = new Thickness(0, 22, 0, 0) };
            toggle.Children.Add(box); toggle.Children.Add(new TextBlock { Text = "立即打开   Open now", FontSize = 15, Foreground = Ink, VerticalAlignment = VerticalAlignment.Center });
            toggle.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e) { e.Handled = true; };
            toggle.MouseLeftButtonUp += delegate { launch = !launch; box.Fill = launch ? Red : Brushes.Transparent; };
            Show(Columns(title, RightColumn("观隅鸮馆已安装",
                Body("Limet Otus Studio is installed.", 16, Mute),
                new Rectangle { Height = 18 },
                Body("首次打开时创建工作室；语音组件可在软件内按需安装。\nCreate your studio when you first open it; voice components can be installed from within the app.", 14, Mute),
                toggle)));
            Action finish = delegate { if (launch) Installer.Launch(targetDir); Close(); };
            Actions(new[] { ActionButton("完成", "Finish", true, finish) }, finish);
        }

        void ShowError(string zh, string en, Action retry, string detail = null)
        {
            SetProgress(0);
            var title = Big("未完成\nNot done", 96); title.VerticalAlignment = VerticalAlignment.Bottom;
            var items = new List<UIElement> { Body(en, 16, Mute), new Rectangle { Height = 18 } };
            if (detail != null) items.Add(Body(detail, 13, Mute));
            Show(Columns(title, RightColumn(zh, items.ToArray())));
            Actions(new[] { ActionButton("关闭", "Close", false, Close), ActionButton("重试", "Retry", true, retry) }, retry);
        }

        void SetProgress(double fraction)
        {
            progressBar.BeginAnimation(WidthProperty, new DoubleAnimation(Math.Max(0, Math.Min(1, fraction)) * (W - 2 * M), TimeSpan.FromMilliseconds(240)));
        }

        /// <summary>English fades in and out, then Chinese, then the next line, until the work ends.</summary>
        async void CycleLines(TextBlock line)
        {
            lines = new CancellationTokenSource(); var token = lines.Token;
            try
            {
                while (!token.IsCancellationRequested)
                    foreach (var pair in Text.Lines)
                        foreach (var text in pair)
                        {
                            line.Text = text;
                            line.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(700)) { EasingFunction = new SineEase() });
                            await Task.Delay(3200, token);
                            line.BeginAnimation(OpacityProperty, new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(700)) { EasingFunction = new SineEase() });
                            await Task.Delay(900, token);
                        }
            }
            catch (TaskCanceledException) { }
        }
        void StopLines() { if (lines != null) lines.Cancel(); }

        // ------------------------------------------------------------------ uninstall pages
        void ShowUninstallConfirm()
        {
            Step(0);
            var title = Big("卸载\nUninstall", 112); title.VerticalAlignment = VerticalAlignment.Bottom;
            Show(Columns(title, RightColumn("移除观隅鸮馆",
                Body("Remove Limet Otus Studio from this computer.", 16, Mute),
                new Rectangle { Height = 18 },
                Body("将删除程序文件和快捷方式。工作室数据、备份和语音组件保留在你的用户目录中，重新安装后可继续使用。\nProgram files and shortcuts are removed. Studio data, backups and voice components stay in your user profile and are used again after reinstalling.", 14, Mute),
                Body(targetDir, 12, Faint))));
            Actions(new[] { ActionButton("取消", "Cancel", false, Close), ActionButton("卸载", "Uninstall", true, StartUninstall) }, StartUninstall);
        }

        void StartUninstall()
        {
            Step(1); busy = true;
            var title = Big("正在卸载\nRemoving", 96); title.VerticalAlignment = VerticalAlignment.Bottom;
            var status = Body("", 13, Mute);
            Show(Columns(title, RightColumn("", status)));
            Actions(new UIElement[0], null);
            string dir = targetDir;
            Task.Factory.StartNew(delegate
            {
                Installer.Uninstall(dir, delegate(double fraction, string text)
                {
                    Dispatcher.BeginInvoke(new Action(delegate { SetProgress(fraction); status.Text = text; }));
                });
            }).ContinueWith(delegate(Task task)
            {
                Dispatcher.BeginInvoke(new Action(delegate
                {
                    busy = false;
                    if (task.IsFaulted) { ShowError("卸载未完成。", "Uninstall did not finish.", StartUninstall, task.Exception.GetBaseException().Message); return; }
                    Step(2);
                    var done = Big("已卸载\nRemoved", 112); done.VerticalAlignment = VerticalAlignment.Bottom;
                    Show(Columns(done, RightColumn("观隅鸮馆已移除", Body("Limet Otus Studio has been removed. Your studio data was kept.", 16, Mute))));
                    Actions(new[] { ActionButton("关闭", "Close", true, Close) }, Close);
                }));
            });
        }
    }
}
