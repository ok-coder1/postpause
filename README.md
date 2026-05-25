# PostPause

A Mod Tool for Reddit that lets mods set a cooldown between each post a user makes. Similar to Discord's Slow Mode.

## Usage
Go to Mod Tools → Installed Apps → PostPause → Installation Settings.

Here, you can set the cooldown between each post of a user, the removal message that gets sent to the user, whether you want to exempt Approved Users from cooldown, and specific cooldowns for each post flair.

<img width="1174" height="567" alt="Screen Shot 2026-05-25 at 8 51 37 PM" src="https://github.com/user-attachments/assets/eb479e92-4728-4fac-a9fd-62ad780c41e4" />

### Cooldown duration
Lets you set how much time a user should wait between making two posts (in minutes).

The default is 15 minutes.

### Removal message
Lets you change the message that gets sent to a user's PMs.

Use the placeholders `r/subredditName` for the subreddit name (can be ommited) and `timeLeft` for the time remaining until they can post again (mandatory).

The default is `Your post in r/subredditName was removed. Please wait **timeLeft** before posting again.`.

### Exempt Approved Users from cooldown
Does what it says. Lets you exempt Approved Users from the cooldown(s).

Default is false.

### Specific cooldowns for each flair
Lets you set separate cooldowns for post flairs.

If there is a flair named `X` and `X` is present here with a cooldown of 10 minutes, then the user creates a post with the flair `X`, the cooldown will be reduced to 10 minutes. Same for every other flair present in this.

Must be in the format `flair: cooldown` with `flair` being the text of the flair and `cooldown` being the cooldown in minutes. Each flair must be separated with a newline.

## Menu actions

<img width="418" height="600" alt="Screen Shot 2026-05-25 at 8 51 25 PM" src="https://github.com/user-attachments/assets/c01d999c-7497-4208-98b8-51735483e4af" />

### Temporarily timeout user

Lets you timeout users for a period of time, rendering them unable to post for that period of time. This does NOT kick them out of the subreddit.

#### Options:
Username of the user to timeout: Automatically filled in
Number of hours to timeout the user for: Set the time you want to timeout the user for (in hours)

### Reset cooldown/unmute user

If muted, untimeout the user, allowing them to post immediately. Else, resets the cooldown for the user, also allowing them to post immediately.

#### Options:
Username of the user to reset cooldown/untimeout: Automatically filled in
