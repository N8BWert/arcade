# Solana Arcade

The Solana arcade is a solana program written by Nate Wert that will allow for anyone to upload arcade games that are playable everyone for a fee of $0.25 per play.


## TLDR:

Game developers can upload webGL builds to the solana arcade, which people can play for a price of $0.25 per play (where each game is played one group at a time).  This money can then be distributed 1/5 to the owner, 4/14 to the first place player, 2/14 to the second place player, and 1/14 to the third place player at the game owner's discretion.  


## Inspiration

During the height of the arcade age people of all ages would go to local arcades for the thrill of playing games for the accessible price of $0.25.  As time progressed and console and mobile gaming took off, however, the experience of the arcade was lost in time.  I thought it would be fun to bring back the experience of the arcade using a modern technology with a slight twist.  

The first thing one should notice when entering the arcade is that only one "group" (by group I mean for a one player game there is one player, two player game there is two players, ...) of players can play any game at a time.  I believe this adds to the experience of the arcade by creating the role of watchers, or people who are watching the game being played (there is a possibility that voice chat will be added (I know there will be a guaranteed ability to shake the arcade though)).

Looking back at the age of the arcade, the biggest draw was probably not the games at the arcade (especially in the second half of the age), but instead the community.  

Now for the twist.  To make things a bit interesting, every play of the arcade machines ($0.25) is added into a pot in the arcade.  This pot can then be distributed (at the owner's discretion) in a 50/50 split between the owner and the top three players on the leader board (4/14 -> top player, 2/14 -> second player, 1/14 -> third player).  Ideally, this small twist should reward incredibly talented players, while still providing long term kickbacks to developers who create arcade games.


## Playing Games in the Arcade

1. Visit [the arcade homepage]()
2. Find a game you like by using the arrows to navigate
   1. The games should be listed in order of newest to oldest
3. Chose a game queue to join for the game (each queue should have an estimated spot in line)
4. Click the join queue button on the game to pay your $0.25 playing fee.
5. Wait your turn to play the game.
   1. In the meantime you can always engage in the voice chat or shake the machine :)
6. Play the game.*

*If you enjoy a game you can click the save to cookies button to save the machine's public key allowing you to go directly to the game in future plays


## Finding a Specific Game in the Arcade

1. Visit [the arcade homepage]()
2. In the search bar, type the name of the game you would like to play.
   1. Currently, the name must be an exact match, however we will likely add fuzzy search at some point in time.
3. Relax while you wait.
   1. I'm still working on a better way to do searching for games, but currently it may take a while depending on how old a game is.
4. Play the game!!!


## Uploading Games to the Arcade

- Unity WebGL Support: **IN PROGRESS**
- Godot: **IF REQUESTED**

*If requested, I can make (or have someone) make support packages/libraries for other game engines to connect their WebGL builds to the arcade.
*I am also 100% ok with the community making support packages/libraries for other game engines someone just needs to make sure that they work with the arcade and I'll list them above.

1. Visit [the upload portal]()
2. Fill in the related fields for your game
3. Upload your game art and WebGL build folder
   1. The WebGL build folder will be checked to ensure it includes an officially supported arcade support package (this is necessary to make sure the game plays nicely with the arcade)
   2. I am going to host the WebGL build and game art on ARWeave because storage of large objects is super expensive on Solana
4. Pay the fee to upload the game to the arcade (or a specific arcade)**
   1. There is a one-time fee to host things on arweave, so this fee will be a one time thing that should decrease in amount over time (as technology improves)
5. Your game should appear as the most recent game in the arcade :)

**I accidentally added the ability to create many arcades, so there is the possibility of arcades being genre specific or whatever is desired.


## Collecting Funds Won in the Arcade

1. Visit [the arcade homepage]()
2. Click on the "Collect Winnings" button
   1. Make sure you use the same wallet you have used to play games
3. In the background the browser will be looking through the various winnings to find any that correspond to you
4. You should see any winnings be funded into your wallet.
5. Use your newly obtained Sol wisely :)


## Supported Wallets

- Phantom

*If there are any other wallets that should be added please leave me a message and I'll work to add other wallet supports.