# Record docs/demo.mp4 with `npm run demo`.
# The demo installs the Sosumi plugin into a temporary Codex home
# and runs real prompts against https://sosumi.ai/mcp.
# It uses your Codex login, but no other Codex configuration.
# The recording skips the time that each prompt takes to answer,
# then replays Codex's events about a second apart.

Output docs/demo.mp4

Require codex
Require jq

Set Shell bash
Set FontSize 15
Set Width 1600
Set Height 1200
Set Padding 24
Set Framerate 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 25ms

Hide
Type@1ms `export PS1='\[\e[1;35m\]$\[\e[0m\] '` Enter
Type@1ms `source docs/demo.sh` Enter
Wait@120s /^\$$/
Type@1ms "clear" Enter
Show

Type "codex plugin add sosumi@sosumi-ai" Sleep 400ms Enter
Wait@60s /^\$$/
Sleep 2s

Ctrl+L
Type "# Reads an API reference page" Enter
Type `ask "How do I use NavigationStack in SwiftUI? Check Apple's documentation."` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Ctrl+L
Type "# Searches Apple's documentation" Enter
Type `ask "Find Apple's documentation for SwiftData model relationships."` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Ctrl+L
Type "# Reads the Human Interface Guidelines" Enter
Type `ask "What do the Human Interface Guidelines say about color?"` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Ctrl+L
Type "# Reads a WWDC session transcript" Enter
Type `ask "Summarize the WWDC21 session about protecting mutable state with Swift actors."` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Ctrl+L
Type "# Reads a third-party Swift-DocC site" Enter
Type `ask "Read the Swift-DocC plugin documentation at https://swiftlang.github.io/swift-docc-plugin/documentation/swiftdoccplugin/ and explain how to generate docs for my package."` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Ctrl+L
Type "# Should not use Sosumi: a general programming task" Enter
Type `ask "Write a Python script that parses a CSV file."` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Ctrl+L
Type "# Should not use Sosumi: another platform's documentation" Enter
Type `ask "How do I set up navigation in Jetpack Compose on Android?"` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Ctrl+L
Type "# Should not use Sosumi: an unrelated request" Enter
Type `ask "What's the weather in Portland today?"` Sleep 400ms Enter
Sleep 300ms
Hide
Wait@300s /^\.$/
Enter
Sleep 50ms
Show
Wait@120s /^\$$/
Sleep 5s

Hide
Type@1ms `cd / && rm -rf "$DEMO"` Enter
