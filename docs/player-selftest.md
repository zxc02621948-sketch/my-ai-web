### Player self-test

Use either of these routes:

- /dev/player-test
- /player-test (fallback)

What it does:
- Sets a 3-track YouTube playlist (T1, T2, T3)
- Runs two loops: normal foreground and background→foreground recovery
- Verifies: index transitions, progress reset (0/0 on end), second-loop reliability

Interpreting results:
- ✓ 切到 T1/T2/T3: activeIndex advanced and playerNext was received
- ✓ 回到第一首檢查 index=0: looped after T3
- ✓ 背景中已切到 ...: background end advanced index; resume happens on return
- ✗ entries indicate transition or sync failure; capture console logs for details

If /dev/player-test returns 404 in your deployment, use /player-test.




