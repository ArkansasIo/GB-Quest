# Chat box and player identity

## Chat box (`src/chatbox.js`)

The chat frame works like the chat box in a classic MMO.

| Feature | How it works |
|---|---|
| Edit-box label | A coloured channel label sits in front of the input: `Say:`, `Party:`, `Guild:`, `[1. General]:`, `[2. Trade]:`, `Tell BRAM:`. Click it to pick a channel. |
| Sticky channels | Plain text goes to the last channel you used. Say, party, raid, instance, guild, officer, numbered channels and whispers stick. Yell and emotes go back to the previous channel after one line. |
| Live switching | Type `/p `, `/g `, `/1 `, `/2 `, `/w name `, `/r ` and so on at the start of the box. The label changes and the command disappears. BACKSPACE on an empty box goes back to Say. |
| History | UP and DOWN in the box step through the last 40 lines you sent, channel included. |
| Tab completion | TAB completes `/commands`, then player names (people online, adventurers nearby, friends, recent speakers, companions). Press TAB again to cycle, SHIFT+TAB to go back. |
| Keys | `/` opens the box with a slash. ESC closes it. C shows or hides the frame. ENTER can open the box from the field (CHAT OPTIONS). It's off by default because ENTER is also START. |
| Toolbar | Channel menu, emote menu, social menu (who, friends, ignore list, AFK, DND, played), text size, jump to latest, options. |
| Names | Click a name in the log to whisper. Right-click it for whisper, invite, add friend, ignore, who or copy name. |
| Frame | Drag the title bar to move the frame and the corner grip to resize it. Double-click the title bar to reset. The frame fades when idle and comes back on hover, focus or a new message. |
| Tabs | Tabs show a dot for unread lines. WHISPER flashes when someone whispers you. |
| Options | ENTER opens chat, fade when idle, timestamps, chat bubbles, combat log, text size, reset position, clear. Kept per browser. |

## Account and character IDs (`src/identity.js`)

| ID | Format | Where it comes from |
|---|---|---|
| Account name | 3-16 letters, digits or `_` | Realm server account name. Device accounts are renamed in TITLE > ACCOUNT > ACCOUNT NAME. |
| **Account UID** | 9-digit number (100000000-999999999), shown as `482-913-057` | Realm server: assigned at registration, unique per realm, and existing accounts get one at server start. Claude sign-in: a stable number derived from the sign-in id. Offline: a device account made on first run. |
| Character username | `NAME#1234` | Made with the hero and kept unique across your save slots. |
| **Player ID** | 9-digit number per hero | Made with the hero. Old saves get one the first time they load. |
| Owner | account UID | Each hero records the account UID that made it. |

You can see them in TITLE > ACCOUNT (the header shows the account name and ID; HEROES & IDS lists each slot's username and player ID), on the character sheet's first page, and with the `/id` (or `/whoami`) chat command. Other players see your player ID in `/who`. Your account UID is never sent to them.
