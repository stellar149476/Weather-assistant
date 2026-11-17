#!/usr/bin/env python3
"""
把分文件版（index.html + styles.css + theme.js + deco.js + app.js）
打包成一个可双击打开、可单独分享、完全离线的 weather-cyber.html。

用法：python3 build.py
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))


def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


html = read("index.html")
css = read("styles.css")
light = read("styles-light.css")
theme = read("theme.js")
deco = read("deco.js")
app = read("app.js")

# 浅色主题用到的壁纸内联成 data URI（用 --wall 变量承载，避免重复嵌入）
import base64
_bg = base64.b64encode(open(os.path.join(HERE, "bg.jpg"), "rb").read()).decode()
light = light.replace('url("bg.jpg")', 'var(--wall)')
light = light.replace(
    'html[data-theme="light"]{',
    'html[data-theme="light"]{\n  --wall:url("data:image/jpeg;base64,' + _bg + '");',
    1,
)

out = html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    "<style>\n" + css + "\n</style>",
)
out = out.replace(
    '<link rel="stylesheet" href="styles-light.css" />',
    "<style>\n" + light + "\n</style>",
)
out = out.replace(
    '<script src="theme.js"></script>',
    "<script>\n" + theme + "\n</script>",
)
out = out.replace(
    '<script src="deco.js"></script>',
    "<script>\n" + deco + "\n</script>",
)
out = out.replace(
    '<script src="app.js"></script>',
    "<script>\n" + app + "\n</script>",
)

target = os.path.join(HERE, "weather-cyber.html")
with open(target, "w", encoding="utf-8") as f:
    f.write(out)

print("已生成 weather-cyber.html  (%.0f KB)" % (len(out.encode("utf-8")) / 1024))
