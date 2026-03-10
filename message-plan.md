Create `message` command that will sent me message.

if they input `message` only, show the command usage. If they:

+input `message <content>` will ask for "You only be able to sent this single message, do you happy with you content, Y to send, No to back to editing [Y/N] :" -> if `Y` then send them "I've received this message through Telegram, wait for my respond (If you did leave contact)"

+input `message --name <user>` to create a terminal that act like a box chat (Would be scrollable, undragable, stick in the rightward corner of the web), between me and the users via telegram. And they can't run `message` until they run `message --stop`, no multiple message instance

If there are multiple requested to message me with the same name at once, raise "Error: Unexisted <name>, please choose another Name"


Propose your your plan on create the database and the telegram bot setup needed to handle this kind of function