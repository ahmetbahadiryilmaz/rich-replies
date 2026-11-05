# Privacy Policy

Effective 2026-11-05. Plugin: rich-replies. Author: Ahmet Bahadır Yılmaz.

rich-replies is a Claude Code mod that only changes how Claude's replies are drawn on your screen.

- **No data collection.** The mod does not collect, store, log or transmit any personal data, telemetry or analytics.
- **No network access.** The mod makes no network requests and fetches nothing. Image links with `http(s):` addresses are left untouched.
- **Local file read.** When a reply contains an image on its own line that points to a local file (for example `![chart](C:\pictures\chart.png)`), the mod reads that single file from your disk through Claude Code's `$.fs.read` API, only to display it inside the reply. The bytes stay in memory on your machine and are not copied, uploaded or written anywhere.
- **Session state.** The only state kept is which task rows you expanded, held in memory for the current session.

Claude Code itself, and your use of Claude, are covered by Anthropic's own privacy policy.

Questions: https://github.com/ahmetbahadiryilmaz/rich-replies/issues
