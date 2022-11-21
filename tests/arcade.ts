import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SplAssociatedTokenInstructionCoder } from "@project-serum/anchor/dist/cjs/coder/spl-associated-token/instruction";
import { assert, AssertionError } from "chai";
import { Arcade } from "../target/types/arcade";

const { makeArcade } = require("./functions/makeArcade.js");
const { makeGame } = require("./functions/makeGame.js");
const { deleteRecentGame } = require("./functions/deleteRecentGame.js");
const { deleteGame } = require("./functions/deleteGame.js");
const { updateLeaderboard } = require("./functions/updateLeaderboard.js");
const { initOnePlayerQueue, initTwoPlayerQueue, initThreePlayerQueue, initFourPlayerQueue } = require("./functions/initQueue.js");
const { joinOnePlayerQueue, joinTwoPlayerQueue, joinThreePlayerQueue, joinFourPlayerQueue, joinKingOfHillQueue } = require("./functions/joinQueue.js");
const { advanceOnePlayerQueue, advanceTwoPlayerQueue, advanceTwoPlayerKingOfHillQueue, advanceThreePlayerQueue,
        advanceFourPlayerQueue, advanceFourPlayerKingOfHillQueue, AdvanceTeamKingOfHillQueue } = require("./functions/advanceQueue.js");
const { finishOnePlayerGameQueue, finishTwoPlayerGameQueue, finishTwoPlayerKingOfHillQueue, finishThreePlayerGameQueue,
        finishThreePlayerKingOfHillQueue, finishFourPlayerGameQueue, finishFourPlayerKingOfHillQueue, finishTeamKingOfHillQueue } = require("./functions/finishQueue.js");

describe("arcade", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Arcade as Program<Arcade>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("Initializes Arcades", async () => {
    const { arcade, genesisGameAccount } = await makeArcade(program, provider);

    assert.equal(arcade.mostRecentGameKey.toString(), genesisGameAccount.publicKey.toString());
    assert.equal(arcade.authority.toString(), provider.wallet.publicKey.toString());
  });

  it("Adds Games to the Arcade", async () => {
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Set game player and type constant parameters
    const numPlayers = 1;
    const gameType = 0;

    const { game, gameAccount, title, webGLHash, gameArtHash, gameWallet } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const updatedArcade = await program.account.arcadeState.fetch(arcadeAccount.publicKey);

    assert.equal(game.title, title);
    assert.equal(game.webGlHash, webGLHash);
    assert.equal(game.gameArtHash, gameArtHash);
    assert.equal(game.maxPlayers, numPlayers);
    assert.equal(game.gameType, gameType);
    assert.equal(game.youngerGameKey.toString(), gameAccount.publicKey.toString());
    assert.equal(game.olderGameKey.toString(), genesisGameAccount.publicKey.toString());
    assert.equal(game.ownerWallet.toString(), provider.wallet.publicKey.toString());
    assert.equal(updatedArcade.mostRecentGameKey.toString(), gameAccount.publicKey.toString());
  });

  it("Creates Games in a Linked List", async () => {
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Set game player and type constant parameters
    const numPlayers = 1;
    const gameType = 0;

    const { gameAccount: gameAccount1 } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { game: game2, gameAccount: gameAccount2 } = await makeGame(program, provider, arcadeAccount, gameAccount1, numPlayers, gameType);

    assert.equal(game2.olderGameKey.toString(), gameAccount1.publicKey.toString());

    const updatedGame1 = await program.account.game.fetch(gameAccount1.publicKey);
    assert.equal(updatedGame1.youngerGameKey.toString(), gameAccount2.publicKey.toString());

    const updatedArcade = await program.account.arcadeState.fetch(arcadeAccount.publicKey);
    assert.equal(updatedArcade.mostRecentGameKey.toString(), gameAccount2.publicKey.toString());
  });

  it("Deletes the Most Recent Game in the Arcade", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Set game player and type constant parameters
    const numPlayers = 1;
    const gameType = 0;

    // Create 3 games for the arcade
    const { gameAccount: gameAccount1 } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);
    const { gameAccount: gameAccount2 } = await makeGame(program, provider, arcadeAccount, gameAccount1, numPlayers, gameType);
    const { gameAccount: gameAccount3 } = await makeGame(program, provider, arcadeAccount, gameAccount2, numPlayers, gameType);

    const { updatedArcade, updatedLaterGame: updatedGame2 } = await deleteRecentGame(program, provider, gameAccount3, arcadeAccount, gameAccount2);

    assert.equal(updatedArcade.mostRecentGameKey.toString(), gameAccount2.publicKey.toString());
    assert.equal(updatedGame2.youngerGameKey.toString(), gameAccount2.publicKey.toString());
  });

  // Deleting the most recent game in the arcade without permission should have a test, but it currently works well

  it("Deletes a Specified Game in the Arcade", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Set game player and type constant parameters
    const numPlayers = 1;
    const gameType = 0;

    // Create 3 games for the arcade
    const { gameAccount: gameAccount1 } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);
    const { gameAccount: gameAccount2 } = await makeGame(program, provider, arcadeAccount, gameAccount1, numPlayers, gameType);
    const { gameAccount: gameAccount3 } = await makeGame(program, provider, arcadeAccount, gameAccount2, numPlayers, gameType);

    const { updatedEarlierGame, updatedLaterGame } = await deleteGame(program, provider, gameAccount2, gameAccount3, gameAccount1);

    assert.equal(updatedEarlierGame.olderGameKey.toString(), gameAccount1.publicKey.toString());
    assert.equal(updatedLaterGame.youngerGameKey.toString(), gameAccount3.publicKey.toString());
  });

  it("Updates first place in game leaderboard", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Set game player and type constant parameters
    const numPlayers = 1;
    const gameType = 0;

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);
    
    // Create first place player
    const playerName = "ABC";
    const score = new anchor.BN(2048);
    const walletKey = anchor.web3.Keypair.generate();

    const { updatedGame } = await updateLeaderboard(program, provider, gameAccount, playerName, score, walletKey);

    assert.equal(updatedGame.leaderboard.firstPlace.name, playerName);
    assert.equal(updatedGame.leaderboard.firstPlace.walletKey.toString(), walletKey.publicKey.toString());
    assert.equal(updatedGame.leaderboard.firstPlace.score.toNumber(), score.toNumber());
  });

  it("Updates second place in game leaderboard", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Set game player and type constant parameters
    const numPlayers = 1;
    const gameType = 0;

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    // Create second place player
    const playerName = "ABC";
    const score = new anchor.BN(75);
    const walletKey = anchor.web3.Keypair.generate();

    const { updatedGame } = await updateLeaderboard(program, provider, gameAccount, playerName, score, walletKey);

    assert.equal(updatedGame.leaderboard.secondPlace.name, playerName);
    assert.equal(updatedGame.leaderboard.secondPlace.walletKey.toString(), walletKey.publicKey.toString());
    assert.equal(updatedGame.leaderboard.secondPlace.score.toNumber(), score.toNumber());
  });

  it("Updates third place in game leaderboard", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Set game player and type constant parameters
    const numPlayers = 1;
    const gameType = 0;

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    // Create third place player
    const playerName = "ABC";
    const score = new anchor.BN(30);
    const walletKey = anchor.web3.Keypair.generate();

    const { updatedGame } = await updateLeaderboard(program, provider, gameAccount, playerName, score, walletKey);

    assert.equal(updatedGame.leaderboard.thirdPlace.name, playerName);
    assert.equal(updatedGame.leaderboard.thirdPlace.walletKey.toString(), walletKey.publicKey.toString());
    assert.equal(updatedGame.leaderboard.thirdPlace.score.toNumber(), score.toNumber());
  });

  it("Initializes a game queue for a king of the hill three player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 3 player game
    const numPlayers = 3;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, gameQueueThree, gameQueueAccountThree, updatedGame } = await initThreePlayerQueue(program, provider, gameAccount);

    assert.equal(player.nextPlayer, null);
    assert.equal(player.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue, 1);
    assert.equal(gameQueueTwo.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.numPlayersInQueue, 0);
    assert.equal(gameQueueThree.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.numPlayersInQueue, 0);
    assert.equal(updatedGame.gameQueues[0].toString(), gameQueueAccountOne.publicKey.toString());
    assert.equal(updatedGame.gameQueues[1].toString(), gameQueueAccountTwo.publicKey.toString());
    assert.equal(updatedGame.gameQueues[2].toString(), gameQueueAccountThree.publicKey.toString());
  });

  it("Initializes a game queue for a king of the hill four player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 4 player game
    const numPlayers = 4;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, gameQueueThree, gameQueueAccountThree, gameQueueFour, gameQueueAccountFour, updatedGame } = await initFourPlayerQueue(program, provider, gameAccount);

    assert.equal(player.nextPlayer, null);
    assert.equal(player.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue, 1);
    assert.equal(gameQueueTwo.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.numPlayersInQueue, 0);
    assert.equal(gameQueueThree.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.numPlayersInQueue, 0);
    assert.equal(gameQueueFour.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueFour.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueFour.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueFour.numPlayersInQueue, 0);
    assert.equal(updatedGame.gameQueues[0].toString(), gameQueueAccountOne.publicKey.toString());
    assert.equal(updatedGame.gameQueues[1].toString(), gameQueueAccountTwo.publicKey.toString());
    assert.equal(updatedGame.gameQueues[2].toString(), gameQueueAccountThree.publicKey.toString());
    assert.equal(updatedGame.gameQueues[3].toString(), gameQueueAccountFour.publicKey.toString());
  });

  it("Initializes a game queue for a team king of the hill four player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 4 player game
    const numPlayers = 4;
    const gameType = 2;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, gameQueueThree, gameQueueAccountThree, gameQueueFour, gameQueueAccountFour, updatedGame } = await initFourPlayerQueue(program, provider, gameAccount);

    assert.equal(player.nextPlayer, null);
    assert.equal(player.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue, 1);
    assert.equal(gameQueueTwo.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueTwo.numPlayersInQueue, 0);
    assert.equal(gameQueueThree.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueThree.numPlayersInQueue, 0);
    assert.equal(gameQueueFour.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueFour.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueFour.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueueFour.numPlayersInQueue, 0);
    assert.equal(updatedGame.gameQueues[0].toString(), gameQueueAccountOne.publicKey.toString());
    assert.equal(updatedGame.gameQueues[1].toString(), gameQueueAccountTwo.publicKey.toString());
    assert.equal(updatedGame.gameQueues[2].toString(), gameQueueAccountThree.publicKey.toString());
    assert.equal(updatedGame.gameQueues[3].toString(), gameQueueAccountFour.publicKey.toString());
  });

  it("allows people to join a one player game queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameter for a 1 player normal game
    const numPlayers = 1;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccount } = await initOnePlayerQueue(program, provider, gameAccount);

    const { player: playerTwo, playerAccount: playerAccountTwo } = await joinOnePlayerQueue(program, provider, gameAccount, gameQueueAccount, playerAccountOne);

    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    
    // Get game queue
    const gameQueue = await program.account.gameQueue.fetch(gameQueueAccount.publicKey);

    assert.equal(playerOne.nextPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueue.lastPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(playerTwo.nextPlayer, null);
    assert.equal(playerTwo.walletKey.toString(), provider.wallet.publicKey);
    assert.equal(gameQueue.numPlayersInQueue.toNumber(), 2);
  });

  // 1 2 3
  it("allows for the filling of the first level of the game queue for a king of the hill three player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 3 player game
    const numPlayers = 3;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree } = await initThreePlayerQueue(program, provider, gameAccount);

    // Add two people to the game queue
    const { playerAccount: playerAccountTwo } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountOne, playerAccountOne);
    const { player: playerThree, playerAccount: playerAccountThree } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountTwo, playerAccountOne);

    // Get updated players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);

    // Get updated queues
    const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const gameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);

    assert.equal(playerOne.nextPlayer, null);
    assert.equal(playerTwo.nextPlayer, null);
    assert.equal(playerThree.nextPlayer, null);
    assert.equal(playerOne.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerTwo.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerThree.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueThree.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueThree.lastPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueTwo.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueThree.numPlayersInQueue.toNumber(), 1);
  });

  // 7 8 9
  // 4 5 6
  // 1 2 3
  it("allows for many people to join a king of the hill three player game queue", async( ) => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 3 player game
    const numPlayers = 3;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, updatedGame } = await initThreePlayerQueue(program, provider, gameAccount);

    // Add two people to the game queue
    const { playerAccount: playerAccountTwo } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountTwo, playerAccountOne);
    const { playerAccount: playerAccountFour } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountTwo, playerAccountThree);
    const { playerAccount: playerAccountFive } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountFour, playerAccountTwo, playerAccountThree);
    const { playerAccount: playerAccountSix } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountFour, playerAccountFive, playerAccountThree);
    const { playerAccount: playerAccountSeven } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountFour, playerAccountFive, playerAccountSix);
    const { playerAccount: playerAccountEight } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountSeven, playerAccountFive, playerAccountSix);
    const { player: playerNine, playerAccount: playerAccountNine } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountSeven, playerAccountEight, playerAccountSix);

    // Get players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);
    const playerThree = await program.account.player.fetch(playerAccountThree.publicKey);
    const playerFour = await program.account.player.fetch(playerAccountFour.publicKey);
    const playerFive = await program.account.player.fetch(playerAccountFive.publicKey);
    const playerSix = await program.account.player.fetch(playerAccountSix.publicKey);
    const playerSeven = await program.account.player.fetch(playerAccountSeven.publicKey);
    const playerEight = await program.account.player.fetch(playerAccountEight.publicKey);

    // Get the queues
    const queueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const queueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const queueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);

    assert.equal(playerOne.nextPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(playerTwo.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(playerThree.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(playerFour.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(playerFive.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(playerSix.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(playerSeven.nextPlayer, null);
    assert.equal(playerEight.nextPlayer, null);
    assert.equal(playerNine.nextPlayer, null);

    assert.equal(queueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(queueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(queueThree.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(queueOne.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(queueTwo.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(queueThree.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(queueOne.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueTwo.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueThree.numPlayersInQueue.toNumber(), 3);
  });

  // 1 2 3 4
  it("allows for the filling of the first level of the game queue for a king of the hill four player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 4 player game
    const numPlayers = 4;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour } = await initFourPlayerQueue(program, provider, gameAccount);

    // Add two people to the game queue
    const { playerAccount: playerAccountTwo } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountOne, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountOne, playerAccountOne);
    const { player: playerFour, playerAccount: playerAccountFour } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountOne);

    // Get updated players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);
    const playerThree = await program.account.player.fetch(playerAccountThree.publicKey);

    // Get updated queues
    const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const gameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const gameQueueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    assert.equal(playerOne.nextPlayer, null);
    assert.equal(playerTwo.nextPlayer, null);
    assert.equal(playerThree.nextPlayer, null);
    assert.equal(playerFour.nextPlayer, null);
    assert.equal(playerOne.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerTwo.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerThree.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerFour.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueThree.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(gameQueueFour.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueThree.lastPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(gameQueueFour.lastPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueTwo.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueThree.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueFour.numPlayersInQueue.toNumber(), 1);
  });

  // 9 10 11 12
  // 5  6  7  8
  // 1  2  3  4
  it("allows for many people to join a king of the hill four person player game queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 4 player game
    const numPlayers = 4;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour } = await initFourPlayerQueue(program, provider, gameAccount);

    // Add two people to the game queue
    const { playerAccount: playerAccountTwo } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountOne, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountFour } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountOne);
    const { playerAccount: playerAccountFive } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountSix } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountTwo, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountSeven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountEight } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountSeven, playerAccountFour);
    const { playerAccount: playerAccountNine } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountTen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountSix, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountEleven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountTen, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountTwelve } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountTen, playerAccountEleven, playerAccountEight);

    // Get players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);
    const playerThree = await program.account.player.fetch(playerAccountThree.publicKey);
    const playerFour = await program.account.player.fetch(playerAccountFour.publicKey);
    const playerFive = await program.account.player.fetch(playerAccountFive.publicKey);
    const playerSix = await program.account.player.fetch(playerAccountSix.publicKey);
    const playerSeven = await program.account.player.fetch(playerAccountSeven.publicKey);
    const playerEight = await program.account.player.fetch(playerAccountEight.publicKey);
    const playerNine = await program.account.player.fetch(playerAccountNine.publicKey);
    const playerTen = await program.account.player.fetch(playerAccountTen.publicKey);
    const playerEleven = await program.account.player.fetch(playerAccountEleven.publicKey);
    const playerTwelve = await program.account.player.fetch(playerAccountTwelve.publicKey);

    // Get game queues
    const queueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const queueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const queueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const queueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    assert.equal(playerOne.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(playerTwo.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(playerThree.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(playerFour.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(playerFive.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(playerSix.nextPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(playerSeven.nextPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(playerEight.nextPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(playerNine.nextPlayer, null);
    assert.equal(playerTen.nextPlayer, null);
    assert.equal(playerEleven.nextPlayer, null);
    assert.equal(playerTwelve.nextPlayer, null);

    assert.equal(queueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(queueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(queueThree.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(queueFour.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(queueOne.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(queueTwo.lastPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(queueThree.lastPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(queueFour.lastPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(queueOne.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueTwo.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueThree.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueFour.numPlayersInQueue.toNumber(), 3);
  });

  // 1 2 3 4
  it("allows for the filling of the first level of the team game queue for a king of the hill four player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 4 player game
    const numPlayers = 4;
    const gameType = 2;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour } = await initFourPlayerQueue(program, provider, gameAccount);

    // Add two people to the game queue
    const { playerAccount: playerAccountTwo } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountOne, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountOne, playerAccountOne);
    const { player: playerFour, playerAccount: playerAccountFour } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountOne);

    // Get updated players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);
    const playerThree = await program.account.player.fetch(playerAccountThree.publicKey);

    // Get updated queues
    const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const gameQueueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const gameQueueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    assert.equal(playerOne.nextPlayer, null);
    assert.equal(playerTwo.nextPlayer, null);
    assert.equal(playerThree.nextPlayer, null);
    assert.equal(playerFour.nextPlayer, null);
    assert.equal(playerOne.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerTwo.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerThree.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(playerFour.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueThree.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(gameQueueFour.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueThree.lastPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(gameQueueFour.lastPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueTwo.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueThree.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueFour.numPlayersInQueue.toNumber(), 1);
  });

  // 9 10 11 12
  // 5  6  7  8
  // 1  2  3  4
  it("allows for many people to join a team king of the hill four person player game queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 4 player game
    const numPlayers = 4;
    const gameType = 2;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour } = await initFourPlayerQueue(program, provider, gameAccount);

    // Add two people to the game queue
    const { playerAccount: playerAccountTwo } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountOne, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountFour } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountOne);
    const { playerAccount: playerAccountFive } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountSix } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountTwo, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountSeven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountEight } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountSeven, playerAccountFour);
    const { playerAccount: playerAccountNine } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountTen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountSix, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountEleven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountTen, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountTwelve } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountTen, playerAccountEleven, playerAccountEight);

    // Get players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);
    const playerThree = await program.account.player.fetch(playerAccountThree.publicKey);
    const playerFour = await program.account.player.fetch(playerAccountFour.publicKey);
    const playerFive = await program.account.player.fetch(playerAccountFive.publicKey);
    const playerSix = await program.account.player.fetch(playerAccountSix.publicKey);
    const playerSeven = await program.account.player.fetch(playerAccountSeven.publicKey);
    const playerEight = await program.account.player.fetch(playerAccountEight.publicKey);
    const playerNine = await program.account.player.fetch(playerAccountNine.publicKey);
    const playerTen = await program.account.player.fetch(playerAccountTen.publicKey);
    const playerEleven = await program.account.player.fetch(playerAccountEleven.publicKey);
    const playerTwelve = await program.account.player.fetch(playerAccountTwelve.publicKey);

    // Get game queues
    const queueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const queueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const queueThree = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const queueFour = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    assert.equal(playerOne.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(playerTwo.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(playerThree.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(playerFour.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(playerFive.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(playerSix.nextPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(playerSeven.nextPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(playerEight.nextPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(playerNine.nextPlayer, null);
    assert.equal(playerTen.nextPlayer, null);
    assert.equal(playerEleven.nextPlayer, null);
    assert.equal(playerTwelve.nextPlayer, null);

    assert.equal(queueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(queueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(queueThree.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(queueFour.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(queueOne.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(queueTwo.lastPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(queueThree.lastPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(queueFour.lastPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(queueOne.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueTwo.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueThree.numPlayersInQueue.toNumber(), 3);
    assert.equal(queueFour.numPlayersInQueue.toNumber(), 3);
  });

  // 2 ->   ->   ->
  // 1 -> 2 ->   -> 3
  it("performs operations on a 1 player queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameter for a 1 player normal game
    const numPlayers = 1;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccount } = await initOnePlayerQueue(program, provider, gameAccount);

    const { playerAccount: playerAccountTwo } = await joinOnePlayerQueue(program, provider, gameAccount, gameQueueAccount, playerAccountOne);

    const { updatedGameQueue } = await advanceOnePlayerQueue(program, provider, playerAccountOne, gameQueueAccount, gameAccount);

    assert.equal(updatedGameQueue.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(updatedGameQueue.lastPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(updatedGameQueue.numPlayersInQueue.toNumber(), 1);

    const { updatedGame } = await finishOnePlayerGameQueue(program, provider, playerAccountTwo, gameQueueAccount, gameAccount);

    assert.equal(updatedGame.gameQueues[0].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountThree, gameQueueAccount: gameQueueAccountTwo } = await initOnePlayerQueue(program, provider, gameAccount);

    const p3 = await program.account.player.fetch(playerAccountThree.publicKey);
    const q2 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const endGame = await program.account.game.fetch(gameAccount.publicKey);

    assert.equal(p3.nextPlayer, null);
    assert.equal(q2.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q2.lastPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q2.numPlayersInQueue.toNumber(), 1);
    assert.equal(endGame.gameQueues[0].toString(), gameQueueAccountTwo.publicKey.toString());
  });

  // 5 6 ->     -> 7   ->     ->     ->     ->    -> 
  // 3 4 -> 5 6 -> 5 6 -> 7   ->     ->     ->    -> 
  // 1 2 -> 3 4 -> 3 4 -> 5 6 -> 7   -> 7 8 ->    -> 9
  it("performs operations on a normal 2 player queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 2 player game
    const numPlayers = 2;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo } = await initTwoPlayerQueue(program, provider, gameAccount);

    // Create player accounts and add them to the queues
    const { playerAccount: playerAccountTwo } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountOne, playerAccountTwo);
    const { playerAccount: playerAccountFour } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountThree, playerAccountTwo);

    // Check these player accounts
    const { playerAccount: playerAccountFive } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountSix } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountFive, playerAccountFour);

    const p10 = await program.account.player.fetch(playerAccountOne.publicKey);
    const p20 = await program.account.player.fetch(playerAccountTwo.publicKey);
    const p30 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p40 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p50 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p60 = await program.account.player.fetch(playerAccountSix.publicKey);

    assert.equal(p10.nextPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(p20.nextPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(p30.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p40.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(p50.nextPlayer, null);
    assert.equal(p60.nextPlayer, null);

    // Advance queue part 1
    const { updatedGameQueueOne: q11, updatedGameQueueTwo: q21} = await advanceTwoPlayerQueue(program, provider, playerAccountOne, playerAccountTwo, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    // Assert format as follows:
    // 5 6
    // 3 4
    const p31 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p41 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p51 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p61 = await program.account.player.fetch(playerAccountSix.publicKey);

    // Assert queues are correct
    assert.equal(q11.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q21.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q11.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q21.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q11.numPlayersInQueue.toNumber(), 2);
    assert.equal(q21.numPlayersInQueue.toNumber(), 2);

    // Assert players are in order
    assert.equal(p31.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p41.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(p51.nextPlayer, null);
    assert.equal(p61.nextPlayer, null);

    // Add player to the queue
    const { playerAccount: playerAccountSeven } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountFive, playerAccountSix);

    // Advance queue part two
    const { updatedGameQueueOne: q12, updatedGameQueueTwo: q22 } = await advanceTwoPlayerQueue(program, provider, playerAccountThree, playerAccountFour, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    // Assert format as follows: 
    // 7
    // 5  6
    const p52 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p62 = await program.account.player.fetch(playerAccountSix.publicKey);
    const p72 = await program.account.player.fetch(playerAccountSeven.publicKey);

    // Assert queues are correct
    assert.equal(q12.currentPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q22.currentPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q12.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q22.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q12.numPlayersInQueue.toNumber(), 2);
    assert.equal(q22.numPlayersInQueue.toNumber(), 1);

    // Assert players are in order
    assert.equal(p52.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(p62.nextPlayer, null);
    assert.equal(p72.nextPlayer, null);

    // Advance queue part three
    const { updatedGameQueueOne: q13, updatedGameQueueTwo: q23 } = await advanceTwoPlayerQueue(program, provider, playerAccountFive, playerAccountSix, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    // Assert format as follows:
    // 7  
    const p73 = await program.account.player.fetch(playerAccountSeven.publicKey);

    // Assert queues are correct
    assert.equal(q13.currentPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q23.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q13.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q23.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q13.numPlayersInQueue.toNumber(), 1);
    assert.equal(q23.numPlayersInQueue.toNumber(), 0);

    // Assert players are in order
    assert.equal(p73.nextPlayer, null);

    const { player: p84, playerAccount: playerAccountEight } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountSeven, playerAccountSeven);

    // Assert format as follows:
    // 7 8
    const q14 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q24 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const p74 = await program.account.player.fetch(playerAccountSeven.publicKey.toString());

    // Assert queues are correct
    assert.equal(q14.currentPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q24.currentPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q14.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q24.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q14.numPlayersInQueue.toNumber(), 1);
    assert.equal(q24.numPlayersInQueue.toNumber(), 1);

    // Assert players are in order
    assert.equal(p74.nextPlayer, null);
    assert.equal(p84.nextPlayer, null);

    const { updatedGame: ug1 } = await finishTwoPlayerGameQueue(program, provider, playerAccountSeven, playerAccountEight, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    assert.equal(ug1.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug1.gameQueues[1].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountNine, gameQueueAccountOne: gameQueueAccountThree, gameQueueAccountTwo: gameQueueAccountFour } = await initTwoPlayerQueue(program, provider, gameAccount);

    const q35 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const q45 = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);
    const ug2 = await program.account.game.fetch(gameAccount.publicKey);
    const p95 = await program.account.player.fetch(playerAccountNine.publicKey);

    assert.equal(p95.nextPlayer, null);
    assert.equal(q35.currentPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q45.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q35.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q45.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q35.numPlayersInQueue.toNumber(), 1);
    assert.equal(q45.numPlayersInQueue.toNumber(), 0);

    const { updatedGame: ug3 } = await finishTwoPlayerGameQueue(program, provider, playerAccountNine, playerAccountNine, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    assert.equal(ug3.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug3.gameQueues[1].toString(), gameAccount.publicKey.toString());
  });

  // 7 8 9 ->       -> 10      ->         ->    -> 16 17    ->       ->          ->   ->       ->   ->    ->
  // 4 5 6 -> 7 8 9 -> 7  8  9 -> 10      ->    -> 13 14 15 ->       ->          ->   ->       ->   ->    ->
  // 1 2 3 -> 4 5 6 -> 4  5  6 -> 7  8  9 -> 10 -> 10 11 12 -> 16 17 -> 16 17 18 ->   -> 19 20 ->   -> 21 -> 
  it("performs operations on a normal 3 player queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 3 player game
    const numPlayers = 3;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree } = await initThreePlayerQueue(program, provider, gameAccount);

    // Create player accounts and add them to the queues
    const { playerAccount: playerAccountTwo } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountTwo, playerAccountOne);
    const { playerAccount: playerAccountFour } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountOne, playerAccountTwo, playerAccountThree);
    const { playerAccount: playerAccountFive } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountFour, playerAccountTwo, playerAccountThree);
    const { playerAccount: playerAccountSix } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountFour, playerAccountFive, playerAccountThree);
    const { playerAccount: playerAccountSeven } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountFour, playerAccountFive, playerAccountSix);
    const { playerAccount: playerAccountEight } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountSeven, playerAccountFive, playerAccountSix);
    const { playerAccount: playerAccountNine } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountSeven, playerAccountEight, playerAccountSix);

    const p10 = await program.account.player.fetch(playerAccountOne.publicKey);
    const p20 = await program.account.player.fetch(playerAccountTwo.publicKey);
    const p30 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p40 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p50 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p60 = await program.account.player.fetch(playerAccountSix.publicKey);
    const p70 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p80 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p90 = await program.account.player.fetch(playerAccountNine.publicKey);
    const q10 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q20 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const q30 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);

    // Assert queues are correct
    assert.equal(p10.nextPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(p20.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p30.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(p40.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(p50.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(p60.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(p70.nextPlayer, null);
    assert.equal(p80.nextPlayer, null);
    assert.equal(p90.nextPlayer, null);
    assert.equal(q10.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(q20.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(q30.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q10.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q20.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q30.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q10.numPlayersInQueue.toNumber(), 3);
    assert.equal(q20.numPlayersInQueue.toNumber(), 3);
    assert.equal(q30.numPlayersInQueue.toNumber(), 3);

    // Advance the game queue
    const { updatedGameQueueOne: q11, updatedGameQueueTwo: q21, updatedGameQueueThree: q31 } = await advanceThreePlayerQueue(program, provider, playerAccountOne, playerAccountTwo, playerAccountThree, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    const p41 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p51 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p61 = await program.account.player.fetch(playerAccountSix.publicKey);
    const p71 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p81 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p91 = await program.account.player.fetch(playerAccountNine.publicKey);

    // Assert queues are correct
    assert.equal(p41.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(p51.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(p61.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(p71.nextPlayer, null);
    assert.equal(p81.nextPlayer, null);
    assert.equal(p91.nextPlayer, null);
    assert.equal(q11.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q21.currentPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q31.currentPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q11.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q21.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q31.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q11.numPlayersInQueue.toNumber(), 2);
    assert.equal(q21.numPlayersInQueue.toNumber(), 2);
    assert.equal(q31.numPlayersInQueue.toNumber(), 2);

    // Add player to queue
    const { playerAccount: playerAccountTen } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountSeven, playerAccountEight, playerAccountNine);

    // Advance queue twice
    await advanceThreePlayerQueue(program, provider, playerAccountFour, playerAccountFive, playerAccountSix, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);
    const { updatedGameQueueOne: q12, updatedGameQueueTwo: q22, updatedGameQueueThree: q32 } = await advanceThreePlayerQueue(program, provider, playerAccountSeven, playerAccountEight, playerAccountNine, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    const p102 = await program.account.player.fetch(playerAccountTen.publicKey);

    // Assert queues are correct
    assert.equal(p102.nextPlayer, null);
    assert.equal(q12.currentPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(q22.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q32.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q12.lastPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(q22.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q32.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q12.numPlayersInQueue.toNumber(), 1);
    assert.equal(q22.numPlayersInQueue.toNumber(), 0);
    assert.equal(q32.numPlayersInQueue.toNumber(), 0);

    const { playerAccount: playerAccountEleven } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountTen, playerAccountTen, playerAccountTen);
    const { playerAccount: playerAccountTwelve } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountTen, playerAccountEleven, playerAccountTen);
    const { playerAccount: playerAccountThirteen } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountTen, playerAccountEleven, playerAccountTwelve);
    const { playerAccount: playerAccountFourteen } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountThirteen, playerAccountEleven, playerAccountTwelve);
    const { playerAccount: playerAccountFifteen } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountThirteen, playerAccountFourteen, playerAccountTwelve);
    const { playerAccount: playerAccountSixteen } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountThirteen, playerAccountFourteen, playerAccountFifteen);
    const { playerAccount: playerAccountSeventeen } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountSixteen, playerAccountFourteen, playerAccountFifteen);

    const p103 = await program.account.player.fetch(playerAccountTen.publicKey);
    const p113 = await program.account.player.fetch(playerAccountEleven.publicKey);
    const p123 = await program.account.player.fetch(playerAccountTwelve.publicKey);
    const p133 = await program.account.player.fetch(playerAccountThirteen.publicKey);
    const p143 = await program.account.player.fetch(playerAccountFourteen.publicKey);
    const p153 = await program.account.player.fetch(playerAccountFifteen.publicKey);
    const p163 = await program.account.player.fetch(playerAccountSixteen.publicKey);
    const p173 = await program.account.player.fetch(playerAccountSeventeen.publicKey);
    const q13 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q23 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const q33 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);

    // Assert queues are correct
    assert.equal(p103.nextPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(p113.nextPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(p123.nextPlayer.toString(), playerAccountFifteen.publicKey.toString());
    assert.equal(p133.nextPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(p143.nextPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q13.currentPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(q23.currentPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(q33.currentPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(q13.lastPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(q23.lastPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q33.lastPlayer.toString(), playerAccountFifteen.publicKey.toString());
    assert.equal(q13.numPlayersInQueue.toNumber(), 3);
    assert.equal(q23.numPlayersInQueue.toNumber(), 3);
    assert.equal(q33.numPlayersInQueue.toNumber(), 2);

    await advanceThreePlayerQueue(program, provider, playerAccountTen, playerAccountEleven, playerAccountTwelve, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);
    const { updatedGameQueueOne: q14, updatedGameQueueTwo: q24, updatedGameQueueThree: q34 } = await advanceThreePlayerQueue(program, provider, playerAccountThirteen, playerAccountFourteen, playerAccountFifteen, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    const p164 = await program.account.player.fetch(playerAccountSixteen.publicKey);
    const p174 = await program.account.player.fetch(playerAccountSeventeen.publicKey);

    // Assert queues are correct
    assert.equal(p164.nextPlayer, null);
    assert.equal(p174.nextPlayer, null);
    assert.equal(q14.currentPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(q24.currentPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q34.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q14.lastPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(q24.lastPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q34.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q14.numPlayersInQueue.toNumber(), 1);
    assert.equal(q24.numPlayersInQueue.toNumber(), 1);
    assert.equal(q34.numPlayersInQueue.toNumber(), 0);

    const { playerAccount: playerAccountEighteen } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, playerAccountSixteen, playerAccountSeventeen, playerAccountSixteen);

    const p165 = await program.account.player.fetch(playerAccountSixteen.publicKey);
    const p175 = await program.account.player.fetch(playerAccountSeventeen.publicKey);
    const p185 = await program.account.player.fetch(playerAccountEighteen.publicKey);
    const q15 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q25 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const q35 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);

    // Assert queues are correct
    assert.equal(p165.nextPlayer, null);
    assert.equal(p175.nextPlayer, null);
    assert.equal(p185.nextPlayer, null);
    assert.equal(q15.currentPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(q25.currentPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q35.currentPlayer.toString(), playerAccountEighteen.publicKey.toString());
    assert.equal(q15.lastPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(q25.lastPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q35.lastPlayer.toString(), playerAccountEighteen.publicKey.toString());
    assert.equal(q15.numPlayersInQueue.toNumber(), 1);
    assert.equal(q25.numPlayersInQueue.toNumber(), 1);
    assert.equal(q35.numPlayersInQueue.toNumber(), 1);

    const { updatedGame: ug1 } = await finishThreePlayerGameQueue(program, provider, playerAccountSixteen, playerAccountSeventeen, playerAccountEighteen, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    // Assert queues are gone
    assert.equal(ug1.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug1.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(ug1.gameQueues[2].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountNineteen, gameQueueAccountOne: gameQueueAccountFour, gameQueueAccountTwo: gameQueueAccountFive, gameQueueAccountThree: gameQueueAccountSix } = await initThreePlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountTwenty } = await joinThreePlayerQueue(program, provider, gameAccount, gameQueueAccountFour, gameQueueAccountFive, gameQueueAccountSix, playerAccountNineteen, playerAccountNineteen, playerAccountNineteen);

    const p196 = await program.account.player.fetch(playerAccountNineteen.publicKey);
    const p206 = await program.account.player.fetch(playerAccountTwenty.publicKey);
    const q46 = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);
    const q56 = await program.account.gameQueue.fetch(gameQueueAccountFive.publicKey);
    const q66 = await program.account.gameQueue.fetch(gameQueueAccountSix.publicKey);
    const ug2 = await program.account.game.fetch(gameAccount.publicKey);

    // Assert queues were made correctly
    assert.equal(p196.nextPlayer, null);
    assert.equal(p206.nextPlayer, null);
    assert.equal(q46.currentPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(q56.currentPlayer.toString(), playerAccountTwenty.publicKey.toString());
    assert.equal(q66.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q46.lastPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(q56.lastPlayer.toString(), playerAccountTwenty.publicKey.toString());
    assert.equal(q66.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q46.numPlayersInQueue.toNumber(), 1);
    assert.equal(q56.numPlayersInQueue.toNumber(), 1);
    assert.equal(q66.numPlayersInQueue.toNumber(), 0);

    const { updatedGame: ug3 } = await finishThreePlayerGameQueue(program, provider, playerAccountNineteen, playerAccountTwenty, playerAccountNineteen, gameQueueAccountFour, gameQueueAccountFive, gameQueueAccountSix, gameAccount);

    // Assert queues are gone
    assert.equal(ug3.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug3.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(ug3.gameQueues[2].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountTwentyOne, gameQueueAccountOne: gameQueueAccountSeven, gameQueueAccountTwo: gameQueueAccountEight, gameQueueAccountThree: gameQueueAccountNine } = await initThreePlayerQueue(program, provider, gameAccount);

    const p217 = await program.account.player.fetch(playerAccountTwentyOne.publicKey);
    const q77 = await program.account.gameQueue.fetch(gameQueueAccountSeven.publicKey);
    const q87 = await program.account.gameQueue.fetch(gameQueueAccountEight.publicKey);
    const q97 = await program.account.gameQueue.fetch(gameQueueAccountNine.publicKey);
    const ug4 = await program.account.game.fetch(gameAccount.publicKey);

    // Assert queues were made correctly
    assert.equal(p217.nextPlayer, null);
    assert.equal(q77.currentPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q87.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q97.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q77.lastPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q87.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q97.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q77.numPlayersInQueue.toNumber(), 1);
    assert.equal(q87.numPlayersInQueue.toNumber(), 0);
    assert.equal(q97.numPlayersInQueue.toNumber(), 0);
    assert.equal(ug4.gameQueues[0].toString(), gameQueueAccountSeven.publicKey.toString());
    assert.equal(ug4.gameQueues[1].toString(), gameQueueAccountEight.publicKey.toString());
    assert.equal(ug4.gameQueues[2].toString(), gameQueueAccountNine.publicKey.toString());

    const { updatedGame: ug5 } = await finishThreePlayerGameQueue(program, provider, playerAccountTwentyOne, playerAccountTwentyOne, playerAccountTwentyOne, gameQueueAccountSeven, gameQueueAccountEight, gameQueueAccountNine, gameAccount);

    assert.equal(ug5.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug5.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(ug5.gameQueues[2].toString(), gameAccount.publicKey.toString());
  });
 
  // 9 10 11 12 ->            -> 13         ->    -> 21 22       ->       -> 29 30 31    ->          ->             ->   ->          ->   ->       ->   ->    ->
  // 5  6  7  8 -> 9 10 11 12 -> 9 10 11 12 ->    -> 17 18 19 20 ->       -> 25 26 27 28 ->          ->             ->   ->          ->   ->       ->   ->    ->
  // 1  2  3  4 -> 5  6  7  8 -> 5  6  7  8 -> 13 -> 13 14 15 16 -> 21 22 -> 21 22 23 24 -> 29 30 31 -> 29 30 31 32 ->   -> 33 34 35 ->   -> 36 37 ->   -> 38 ->
  it("performs operations on a normal 4 player queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 4 player game
    const numPlayers = 4;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour } = await initFourPlayerQueue(program, provider, gameAccount);

    // Create player accounts and add them to the queues
    const { playerAccount: playerAccountTwo } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountOne, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountFour } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountOne);
    const { playerAccount: playerAccountFive } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountSix } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountTwo, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountSeven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountThree, playerAccountFour);
    const { playerAccount: playerAccountEight } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountSeven, playerAccountFour);
    const { playerAccount: playerAccountNine } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountFive, playerAccountSix, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountTen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountSix, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountEleven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountTen, playerAccountSeven, playerAccountEight);
    const { playerAccount: playerAccountTwelve } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountTen, playerAccountEleven, playerAccountEight);

    const p10 = await program.account.player.fetch(playerAccountOne.publicKey);
    const p20 = await program.account.player.fetch(playerAccountTwo.publicKey);
    const p30 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p40 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p50 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p60 = await program.account.player.fetch(playerAccountSix.publicKey);
    const p70 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p80 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p90 = await program.account.player.fetch(playerAccountNine.publicKey);
    const p100 = await program.account.player.fetch(playerAccountTen.publicKey);
    const p110 = await program.account.player.fetch(playerAccountEleven.publicKey);
    const p120 = await program.account.player.fetch(playerAccountTwelve.publicKey);
    const q10 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q20 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const q30 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const q40 = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    // Assert queues are correct
    assert.equal(p10.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p20.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(p30.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(p40.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(p50.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(p60.nextPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(p70.nextPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(p80.nextPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(p90.nextPlayer, null);
    assert.equal(p100.nextPlayer, null);
    assert.equal(p110.nextPlayer, null);
    assert.equal(p120.nextPlayer, null);
    assert.equal(q10.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(q20.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(q30.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q40.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q10.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q20.lastPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(q30.lastPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(q40.lastPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(q10.numPlayersInQueue.toNumber(), 3);
    assert.equal(q20.numPlayersInQueue.toNumber(), 3);
    assert.equal(q30.numPlayersInQueue.toNumber(), 3);
    assert.equal(q40.numPlayersInQueue.toNumber(), 3);

    // Advance the game queue
    const { updatedGameQueueOne: q11, updatedGameQueueTwo: q21, updatedGameQueueThree: q31, updatedGameQueueFour: q41 } = await advanceFourPlayerQueue(program, provider, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountFour, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    const p51 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p61 = await program.account.player.fetch(playerAccountSix.publicKey);
    const p71 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p81 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p91 = await program.account.player.fetch(playerAccountNine.publicKey);
    const p101 = await program.account.player.fetch(playerAccountTen.publicKey);
    const p111 = await program.account.player.fetch(playerAccountEleven.publicKey);
    const p121 = await program.account.player.fetch(playerAccountTwelve.publicKey);

    // Assert queues are correct
    assert.equal(p51.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(p61.nextPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(p71.nextPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(p81.nextPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(p91.nextPlayer, null);
    assert.equal(p101.nextPlayer, null);
    assert.equal(p111.nextPlayer, null);
    assert.equal(p121.nextPlayer, null);
    assert.equal(q11.currentPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q21.currentPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q31.currentPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q41.currentPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q11.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q21.lastPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(q31.lastPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(q41.lastPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(q11.numPlayersInQueue.toNumber(), 2);
    assert.equal(q21.numPlayersInQueue.toNumber(), 2);
    assert.equal(q31.numPlayersInQueue.toNumber(), 2);
    assert.equal(q41.numPlayersInQueue.toNumber(), 2);

    const { playerAccount: playerAccountThirteen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountNine, playerAccountTen, playerAccountEleven, playerAccountTwelve);
    await advanceFourPlayerQueue(program, provider, playerAccountFive, playerAccountSix, playerAccountSeven, playerAccountEight, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);
    const { updatedGameQueueOne: q12, updatedGameQueueTwo: q22, updatedGameQueueThree: q32, updatedGameQueueFour: q42 } = await advanceFourPlayerQueue(program, provider, playerAccountNine, playerAccountTen, playerAccountEleven, playerAccountTwelve, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    const p132 = await program.account.player.fetch(playerAccountThirteen.publicKey);

    // Assert queues are correct
    assert.equal(p132.nextPlayer, null);
    assert.equal(q12.currentPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(q22.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q32.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q42.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q12.lastPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(q22.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q32.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q42.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q12.numPlayersInQueue.toNumber(), 1);
    assert.equal(q22.numPlayersInQueue.toNumber(), 0);
    assert.equal(q32.numPlayersInQueue.toNumber(), 0);
    assert.equal(q42.numPlayersInQueue.toNumber(), 0);

    const { playerAccount: playerAccountFourteen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountThirteen, playerAccountThirteen, playerAccountThirteen, playerAccountThirteen);
    const { playerAccount: playerAccountFifteen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountThirteen, playerAccountFourteen, playerAccountThirteen, playerAccountThirteen);
    const { playerAccount: playerAccountSixteen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountThirteen, playerAccountFourteen, playerAccountFifteen, playerAccountThirteen);
    const { playerAccount: playerAccountSeventeen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountThirteen, playerAccountFourteen, playerAccountFifteen, playerAccountSixteen);
    const { playerAccount: playerAccountEighteen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountSeventeen, playerAccountFourteen, playerAccountFifteen, playerAccountSixteen);
    const { playerAccount: playerAccountNineteen } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountSeventeen, playerAccountEighteen, playerAccountFifteen, playerAccountSixteen);
    const { playerAccount: playerAccountTwenty } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountSeventeen, playerAccountEighteen, playerAccountNineteen, playerAccountSixteen);
    const { playerAccount: playerAccountTwentyOne } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountSeventeen, playerAccountEighteen, playerAccountNineteen, playerAccountTwenty);
    const { playerAccount: playerAccountTwentyTwo } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyOne, playerAccountEighteen, playerAccountNineteen, playerAccountTwenty);

    const p133 = await program.account.player.fetch(playerAccountThirteen.publicKey);
    const p143 = await program.account.player.fetch(playerAccountFourteen.publicKey);
    const p153 = await program.account.player.fetch(playerAccountFifteen.publicKey);
    const p163 = await program.account.player.fetch(playerAccountSixteen.publicKey);
    const p173 = await program.account.player.fetch(playerAccountSeventeen.publicKey);
    const p183 = await program.account.player.fetch(playerAccountEighteen.publicKey);
    const p193 = await program.account.player.fetch(playerAccountNineteen.publicKey);
    const p203 = await program.account.player.fetch(playerAccountTwenty.publicKey);
    const p213 = await program.account.player.fetch(playerAccountTwentyOne.publicKey);
    const p223 = await program.account.player.fetch(playerAccountTwentyTwo.publicKey);
    const q13 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q23 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const q33 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const q43 = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    // Assert queues are correct
    assert.equal(p133.nextPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(p143.nextPlayer.toString(), playerAccountEighteen.publicKey.toString());
    assert.equal(p153.nextPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(p163.nextPlayer.toString(), playerAccountTwenty.publicKey.toString());
    assert.equal(p173.nextPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(p183.nextPlayer.toString(), playerAccountTwentyTwo.publicKey.toString());
    assert.equal(p193.nextPlayer, null);
    assert.equal(p203.nextPlayer, null);
    assert.equal(p213.nextPlayer, null);
    assert.equal(p223.nextPlayer, null);
    assert.equal(q13.currentPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(q23.currentPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(q33.currentPlayer.toString(), playerAccountFifteen.publicKey.toString());
    assert.equal(q43.currentPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(q13.lastPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q23.lastPlayer.toString(), playerAccountTwentyTwo.publicKey.toString());
    assert.equal(q33.lastPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(q43.lastPlayer.toString(), playerAccountTwenty.publicKey.toString());
    assert.equal(q13.numPlayersInQueue.toNumber(), 3);
    assert.equal(q23.numPlayersInQueue.toNumber(), 3);
    assert.equal(q33.numPlayersInQueue.toNumber(), 2);
    assert.equal(q43.numPlayersInQueue.toNumber(), 2);

    await advanceFourPlayerQueue(program, provider, playerAccountThirteen, playerAccountFourteen, playerAccountFifteen, playerAccountSixteen, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);
    const { updatedGameQueueOne: q14, updatedGameQueueTwo: q24, updatedGameQueueThree: q34, updatedGameQueueFour: q44 } = await advanceFourPlayerQueue(program, provider, playerAccountSeventeen, playerAccountEighteen, playerAccountNineteen, playerAccountTwenty, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    const p214 = await program.account.player.fetch(playerAccountTwentyOne.publicKey);
    const p224 = await program.account.player.fetch(playerAccountTwentyTwo.publicKey);

    // Assert queues are correct
    assert.equal(p214.nextPlayer, null);
    assert.equal(p224.nextPlayer, null);
    assert.equal(q14.currentPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q24.currentPlayer.toString(), playerAccountTwentyTwo.publicKey.toString());
    assert.equal(q34.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q44.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q14.lastPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q24.lastPlayer.toString(), playerAccountTwentyTwo.publicKey.toString());
    assert.equal(q34.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q44.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q14.numPlayersInQueue.toNumber(), 1);
    assert.equal(q24.numPlayersInQueue.toNumber(), 1);
    assert.equal(q34.numPlayersInQueue.toNumber(), 0);
    assert.equal(q44.numPlayersInQueue.toNumber(), 0);

    const { playerAccount: playerAccountTwentyThree } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyOne, playerAccountTwentyTwo, playerAccountTwentyOne, playerAccountTwentyOne);
    const { playerAccount: playerAccountTwentyFour } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyOne, playerAccountTwentyTwo, playerAccountTwentyThree, playerAccountTwentyOne);
    const { playerAccount: playerAccountTwentyFive } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyOne, playerAccountTwentyTwo, playerAccountTwentyThree, playerAccountTwentyFour);
    const { playerAccount: playerAccountTwentySix } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyFive, playerAccountTwentyTwo, playerAccountTwentyThree, playerAccountTwentyFour);
    const { playerAccount: playerAccountTwentySeven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyFive, playerAccountTwentySix, playerAccountTwentyThree, playerAccountTwentyFour);
    const { playerAccount: playerAccountTwentyEight } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyFive, playerAccountTwentySix, playerAccountTwentySeven, playerAccountTwentyFour);
    const { playerAccount: playerAccountTwentyNine } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyFive, playerAccountTwentySix, playerAccountTwentySeven, playerAccountTwentyEight);
    const { playerAccount: playerAccountThirty } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyNine, playerAccountTwentySix, playerAccountTwentySeven, playerAccountTwentyEight);
    const { playerAccount: playerAccountThirtyOne } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyNine, playerAccountThirty, playerAccountTwentySeven, playerAccountTwentyEight);

    const p215 = await program.account.player.fetch(playerAccountTwentyOne.publicKey);
    const p225 = await program.account.player.fetch(playerAccountTwentyTwo.publicKey);
    const p235 = await program.account.player.fetch(playerAccountTwentyThree.publicKey);
    const p245 = await program.account.player.fetch(playerAccountTwentyFour.publicKey);
    const p255 = await program.account.player.fetch(playerAccountTwentyFive.publicKey);
    const p265 = await program.account.player.fetch(playerAccountTwentySix.publicKey);
    const p275 = await program.account.player.fetch(playerAccountTwentySeven.publicKey);
    const p285 = await program.account.player.fetch(playerAccountTwentyEight.publicKey);
    const p295 = await program.account.player.fetch(playerAccountTwentyNine.publicKey);
    const p305 = await program.account.player.fetch(playerAccountThirty.publicKey);
    const p315 = await program.account.player.fetch(playerAccountThirtyOne.publicKey);
    const q15 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q25 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);
    const q35 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const q45 = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    // Assert queues are correct
    assert.equal(p215.nextPlayer.toString(), playerAccountTwentyFive.publicKey.toString());
    assert.equal(p225.nextPlayer.toString(), playerAccountTwentySix.publicKey.toString());
    assert.equal(p235.nextPlayer.toString(), playerAccountTwentySeven.publicKey.toString());
    assert.equal(p245.nextPlayer.toString(), playerAccountTwentyEight.publicKey.toString());
    assert.equal(p255.nextPlayer.toString(), playerAccountTwentyNine.publicKey.toString());
    assert.equal(p265.nextPlayer.toString(), playerAccountThirty.publicKey.toString());
    assert.equal(p275.nextPlayer.toString(), playerAccountThirtyOne.publicKey.toString());
    assert.equal(p285.nextPlayer, null);
    assert.equal(p295.nextPlayer, null);
    assert.equal(p305.nextPlayer, null);
    assert.equal(p315.nextPlayer, null);
    assert.equal(q15.currentPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q25.currentPlayer.toString(), playerAccountTwentyTwo.publicKey.toString());
    assert.equal(q35.currentPlayer.toString(), playerAccountTwentyThree.publicKey.toString());
    assert.equal(q45.currentPlayer.toString(), playerAccountTwentyFour.publicKey.toString());
    assert.equal(q15.lastPlayer.toString(), playerAccountTwentyNine.publicKey.toString());
    assert.equal(q25.lastPlayer.toString(), playerAccountThirty.publicKey.toString());
    assert.equal(q35.lastPlayer.toString(), playerAccountThirtyOne.publicKey.toString());
    assert.equal(q45.lastPlayer.toString(), playerAccountTwentyEight.publicKey.toString());
    assert.equal(q15.numPlayersInQueue.toNumber(), 3);
    assert.equal(q25.numPlayersInQueue.toNumber(), 3);
    assert.equal(q35.numPlayersInQueue.toNumber(), 3);
    assert.equal(q45.numPlayersInQueue.toNumber(), 2);

    await advanceFourPlayerQueue(program, provider, playerAccountTwentyOne, playerAccountTwentyTwo, playerAccountTwentyThree, playerAccountTwentyFour, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);
    const { updatedGameQueueOne: q16, updatedGameQueueTwo: q26, updatedGameQueueThree: q36, updatedGameQueueFour: q46 } = await advanceFourPlayerQueue(program, provider, playerAccountTwentyFive, playerAccountTwentySix, playerAccountTwentySeven, playerAccountTwentyEight, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    const p296 = await program.account.player.fetch(playerAccountTwentyNine.publicKey);
    const p306 = await program.account.player.fetch(playerAccountThirty.publicKey);
    const p316 = await program.account.player.fetch(playerAccountThirtyOne.publicKey);

    assert.equal(p296.nextPlayer, null);
    assert.equal(p306.nextPlayer, null);
    assert.equal(p316.nextPlayer, null);
    assert.equal(q16.currentPlayer.toString(), playerAccountTwentyNine.publicKey.toString());
    assert.equal(q26.currentPlayer.toString(), playerAccountThirty.publicKey.toString());
    assert.equal(q36.currentPlayer.toString(), playerAccountThirtyOne.publicKey.toString());
    assert.equal(q46.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q16.lastPlayer.toString(), playerAccountTwentyNine.publicKey.toString());
    assert.equal(q26.lastPlayer.toString(), playerAccountThirty.publicKey.toString());
    assert.equal(q36.lastPlayer.toString(), playerAccountThirtyOne.publicKey.toString());
    assert.equal(q46.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q16.numPlayersInQueue.toNumber(), 1);
    assert.equal(q26.numPlayersInQueue.toNumber(), 1);
    assert.equal(q36.numPlayersInQueue.toNumber(), 1);
    assert.equal(q46.numPlayersInQueue.toNumber(), 0);

    const { playerAccount: playerAccountThirtyTwo } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, playerAccountTwentyNine, playerAccountThirty, playerAccountThirtyOne, playerAccountTwentyNine);
    const { updatedGame: ug7 } = await finishFourPlayerGameQueue(program, provider, playerAccountTwentyNine, playerAccountThirty, playerAccountThirtyOne, playerAccountThirtyTwo, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    // Assert queues are gone
    assert.equal(ug7.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug7.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(ug7.gameQueues[2].toString(), gameAccount.publicKey.toString());
    assert.equal(ug7.gameQueues[3].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountThirtyThree, gameQueueAccountOne: gameQueueAccountFive, gameQueueAccountTwo: gameQueueAccountSix, gameQueueAccountThree: gameQueueAccountSeven, gameQueueAccountFour: gameQueueAccountEight } = await initFourPlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountThirtyFour } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountFive, gameQueueAccountSix, gameQueueAccountSeven, gameQueueAccountEight, playerAccountThirtyThree, playerAccountThirtyThree, playerAccountThirtyThree, playerAccountThirtyThree);
    const { playerAccount: playerAccountThirtyFive } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountFive, gameQueueAccountSix, gameQueueAccountSeven, gameQueueAccountEight, playerAccountThirtyThree, playerAccountThirtyFour, playerAccountThirtyThree, playerAccountThirtyThree);

    const p337 = await program.account.player.fetch(playerAccountThirtyThree.publicKey);
    const p347 = await program.account.player.fetch(playerAccountThirtyFour.publicKey);
    const p357 = await program.account.player.fetch(playerAccountThirtyFive.publicKey);
    const q57 = await program.account.gameQueue.fetch(gameQueueAccountFive.publicKey);
    const q67 = await program.account.gameQueue.fetch(gameQueueAccountSix.publicKey);
    const q77 = await program.account.gameQueue.fetch(gameQueueAccountSeven.publicKey);
    const q87 = await program.account.gameQueue.fetch(gameQueueAccountEight.publicKey);
    const ug8 = await program.account.game.fetch(gameAccount.publicKey);

    // Assert players were added correctly
    assert.equal(p337.nextPlayer, null);
    assert.equal(p347.nextPlayer, null);
    assert.equal(p357.nextPlayer, null);
    assert.equal(q57.currentPlayer.toString(), playerAccountThirtyThree.publicKey.toString());
    assert.equal(q67.currentPlayer.toString(), playerAccountThirtyFour.publicKey.toString());
    assert.equal(q77.currentPlayer.toString(), playerAccountThirtyFive.publicKey.toString());
    assert.equal(q87.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q57.lastPlayer.toString(), playerAccountThirtyThree.publicKey.toString());
    assert.equal(q67.lastPlayer.toString(), playerAccountThirtyFour.publicKey.toString());
    assert.equal(q77.lastPlayer.toString(), playerAccountThirtyFive.publicKey.toString());
    assert.equal(q87.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q57.numPlayersInQueue.toNumber(), 1);
    assert.equal(q67.numPlayersInQueue.toNumber(), 1);
    assert.equal(q77.numPlayersInQueue.toNumber(), 1);
    assert.equal(q87.numPlayersInQueue.toNumber(), 0);
    assert.equal(ug8.gameQueues[0].toString(), gameQueueAccountFive.publicKey.toString());
    assert.equal(ug8.gameQueues[1].toString(), gameQueueAccountSix.publicKey.toString());
    assert.equal(ug8.gameQueues[2].toString(), gameQueueAccountSeven.publicKey.toString());
    assert.equal(ug8.gameQueues[3].toString(), gameQueueAccountEight.publicKey.toString());

    const { updatedGame: ug9 } = await finishFourPlayerGameQueue(program, provider, playerAccountThirtyThree, playerAccountThirtyFour, playerAccountThirtyFive, playerAccountThirtyThree, gameQueueAccountFive, gameQueueAccountSix, gameQueueAccountSeven, gameQueueAccountEight, gameAccount);

    // Assert queues were removed correctly
    assert.equal(ug9.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug9.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(ug9.gameQueues[2].toString(), gameAccount.publicKey.toString());
    assert.equal(ug9.gameQueues[3].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountThirtySix, gameQueueAccountOne: gameQueueAccountNine, gameQueueAccountTwo: gameQueueAccountTen, gameQueueAccountThree: gameQueueAccountEleven, gameQueueAccountFour: gameQueueAccountTwelve } = await initFourPlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountThirtySeven } = await joinFourPlayerQueue(program, provider, gameAccount, gameQueueAccountNine, gameQueueAccountTen, gameQueueAccountEleven, gameQueueAccountTwelve, playerAccountThirtySix, playerAccountThirtySix, playerAccountThirtySix, playerAccountThirtySix);

    const p368 = await program.account.player.fetch(playerAccountThirtySix.publicKey);
    const p378 = await program.account.player.fetch(playerAccountThirtySeven.publicKey);
    const q98 = await program.account.gameQueue.fetch(gameQueueAccountNine.publicKey);
    const q108 = await program.account.gameQueue.fetch(gameQueueAccountTen.publicKey);
    const q118 = await program.account.gameQueue.fetch(gameQueueAccountEleven.publicKey);
    const q128 = await program.account.gameQueue.fetch(gameQueueAccountTwelve.publicKey);
    const ug10 = await program.account.game.fetch(gameAccount.publicKey);

    // Assert queues were make correctly
    assert.equal(p368.nextPlayer, null);
    assert.equal(p378.nextPlayer, null);
    assert.equal(q98.currentPlayer.toString(), playerAccountThirtySix.publicKey.toString());
    assert.equal(q108.currentPlayer.toString(), playerAccountThirtySeven.publicKey.toString());
    assert.equal(q118.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q128.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q98.lastPlayer.toString(), playerAccountThirtySix.publicKey.toString());
    assert.equal(q108.lastPlayer.toString(), playerAccountThirtySeven.publicKey.toString());
    assert.equal(q118.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q128.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q98.numPlayersInQueue.toNumber(), 1);
    assert.equal(q108.numPlayersInQueue.toNumber(), 1);
    assert.equal(q118.numPlayersInQueue.toNumber(), 0);
    assert.equal(q128.numPlayersInQueue.toNumber(), 0);
    assert.equal(ug10.gameQueues[0].toString(), gameQueueAccountNine.publicKey.toString());
    assert.equal(ug10.gameQueues[1].toString(), gameQueueAccountTen.publicKey.toString());
    assert.equal(ug10.gameQueues[2].toString(), gameQueueAccountEleven.publicKey.toString());
    assert.equal(ug10.gameQueues[3].toString(), gameQueueAccountTwelve.publicKey.toString());

    const { updatedGame: ug11 } = await finishFourPlayerGameQueue(program, provider, playerAccountThirtySix, playerAccountThirtySeven, playerAccountThirtySix, playerAccountThirtySix, gameQueueAccountNine, gameQueueAccountTen, gameQueueAccountEleven, gameQueueAccountTwelve, gameAccount);

    // Assert queues were removed correctly
    assert.equal(ug11.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug11.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(ug11.gameQueues[2].toString(), gameAccount.publicKey.toString());
    assert.equal(ug11.gameQueues[3].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountThirtyEight, gameQueueAccountOne: gameQueueAccountThirteen, gameQueueAccountTwo: gameQueueAccountFourteen, gameQueueAccountThree: gameQueueAccountFifteen, gameQueueAccountFour: gameQueueAccountSixteen } = await initFourPlayerQueue(program, provider, gameAccount);

    const p3812 = await program.account.player.fetch(playerAccountThirtyEight.publicKey);
    const q1312 = await program.account.gameQueue.fetch(gameQueueAccountThirteen.publicKey);
    const q1412 = await program.account.gameQueue.fetch(gameQueueAccountFourteen.publicKey);
    const q1512 = await program.account.gameQueue.fetch(gameQueueAccountFifteen.publicKey);
    const q1612 = await program.account.gameQueue.fetch(gameQueueAccountSixteen.publicKey);
    const ug12 = await program.account.game.fetch(gameAccount.publicKey);

    assert.equal(p3812.nextPlayer, null);
    assert.equal(q1312.currentPlayer.toString(), playerAccountThirtyEight.publicKey.toString());
    assert.equal(q1412.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1512.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1612.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1312.lastPlayer.toString(), playerAccountThirtyEight.publicKey.toString());
    assert.equal(q1412.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1512.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1612.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1312.numPlayersInQueue.toNumber(), 1);
    assert.equal(q1412.numPlayersInQueue.toNumber(), 0);
    assert.equal(q1512.numPlayersInQueue.toNumber(), 0);
    assert.equal(q1612.numPlayersInQueue.toNumber(), 0);
    assert.equal(ug12.gameQueues[0].toString(), gameQueueAccountThirteen.publicKey.toString());
    assert.equal(ug12.gameQueues[1].toString(), gameQueueAccountFourteen.publicKey.toString());
    assert.equal(ug12.gameQueues[2].toString(), gameQueueAccountFifteen.publicKey.toString());
    assert.equal(ug12.gameQueues[3].toString(), gameQueueAccountSixteen.publicKey.toString());

    const { updatedGame: ug13 } = await finishFourPlayerGameQueue(program, provider, playerAccountThirtyEight, playerAccountThirtyEight, playerAccountThirtyEight, playerAccountThirtyEight, gameQueueAccountThirteen, gameQueueAccountFourteen, gameQueueAccountFifteen, gameQueueAccountSixteen, gameAccount);

    // Assert queues were removed correctly
    assert.equal(ug13.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug13.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(ug13.gameQueues[2].toString(), gameAccount.publicKey.toString());
    assert.equal(ug13.gameQueues[3].toString(), gameAccount.publicKey.toString());
  });

  // 5 6 -> 5   ->     ->     ->     ->   ->   ->     ->     ->     -> 
  // 3 4 -> 3 6 -> 5 6 -> 5   ->     ->   ->   ->   9 ->     ->     -> 
  // 1 2 -> 1 4 -> 3 4 -> 3 6 -> 3 5 -> 3 ->   -> 7 8 -> 9 8 -> _ 8 -> 
  it("performs operations on a king of the hill 2 player queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 2 player game
    const numPlayers = 2;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo } = await initTwoPlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountTwo } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountOne, playerAccountOne);
    const { playerAccount: playerAccountFour } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountTwo);
    const { playerAccount: playerAccountFive } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountOne, playerAccountThree);
    const { playerAccount: playerAccountSix } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountFour);

    const p10 = await program.account.player.fetch(playerAccountOne.publicKey);
    const p20 = await program.account.player.fetch(playerAccountTwo.publicKey);
    const p30 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p40 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p50 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p60 = await program.account.player.fetch(playerAccountSix.publicKey);
    const q10 = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const q20 = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);

    // Assert queues were created correctly
    assert.equal(p10.nextPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(p20.nextPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(p30.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p40.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(p50.nextPlayer, null);
    assert.equal(p60.nextPlayer, null);
    assert.equal(q10.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(q20.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(q10.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q20.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q10.numPlayersInQueue.toNumber(), 3);
    assert.equal(q20.numPlayersInQueue.toNumber(), 3);

    const { updatedGameQueueOne: q11, updatedGameQueueTwo: q21 } = await advanceTwoPlayerKingOfHillQueue(program, provider, playerAccountOne, playerAccountTwo, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    const p11 = await program.account.player.fetch(playerAccountOne.publicKey);
    const p31 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p41 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p51 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p61 = await program.account.player.fetch(playerAccountSix.publicKey);

    // Assert queues were advanced correctly
    assert.equal(p11.nextPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(p31.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p41.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(p51.nextPlayer, null);
    assert.equal(p61.nextPlayer, null);
    assert.equal(q11.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(q21.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q11.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q21.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q11.numPlayersInQueue.toNumber(), 3);
    assert.equal(q21.numPlayersInQueue.toNumber(), 2);

    const { updatedGameQueueOne: q12, updatedGameQueueTwo: q22 } = await advanceTwoPlayerKingOfHillQueue(program, provider, playerAccountFour, playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    const p32 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p42 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p52 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p62 = await program.account.player.fetch(playerAccountSix.publicKey);

    // Assert queues were advance correctly
    assert.equal(p32.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p42.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(p52.nextPlayer, null);
    assert.equal(p62.nextPlayer, null);
    assert.equal(q12.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q22.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q12.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q22.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q12.numPlayersInQueue.toNumber(), 2);
    assert.equal(q22.numPlayersInQueue.toNumber(), 2);

    const { updatedGameQueueOne: q13, updatedGameQueueTwo: q23 } = await advanceTwoPlayerKingOfHillQueue(program, provider, playerAccountThree, playerAccountFour, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    const p33 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p53 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p63 = await program.account.player.fetch(playerAccountSix.publicKey);

    // Assert queues were advanced correctly
    assert.equal(p33.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(p53.nextPlayer, null);
    assert.equal(p63.nextPlayer, null);
    assert.equal(q13.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q23.currentPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q13.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q23.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q13.numPlayersInQueue.toNumber(), 2);
    assert.equal(q23.numPlayersInQueue.toNumber(), 1);

    const { updatedGameQueueOne: q14, updatedGameQueueTwo: q24 } = await advanceTwoPlayerKingOfHillQueue(program, provider, playerAccountThree, playerAccountSix, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    const p34 = await program.account.player.fetch(playerAccountThree.publicKey);
    const p54 = await program.account.player.fetch(playerAccountFive.publicKey);

    // Assert queues were advanced correctly
    assert.equal(p34.nextPlayer, null);
    assert.equal(p54.nextPlayer, null);
    assert.equal(q14.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q24.currentPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q14.lastPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q24.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q14.numPlayersInQueue.toNumber(), 1);
    assert.equal(q24.numPlayersInQueue.toNumber(), 1);

    const { updatedGameQueueOne: q15, updatedGameQueueTwo: q25 } = await advanceTwoPlayerKingOfHillQueue(program, provider, playerAccountThree, playerAccountFive, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    const p35 = await program.account.player.fetch(playerAccountThree.publicKey);

    // Assert queues were advanced correctly
    assert.equal(p35.nextPlayer, null);
    assert.equal(q15.currentPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q25.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q15.lastPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(q25.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q15.numPlayersInQueue.toNumber(), 1);
    assert.equal(q25.numPlayersInQueue.toNumber(), 0);

    const { updatedGame: ug6 } = await finishTwoPlayerKingOfHillQueue(program, provider, playerAccountThree, gameQueueAccountOne, gameQueueAccountTwo, gameAccount);

    // Assert queue was removed correctly
    assert.equal(ug6.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug6.gameQueues[1].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountSeven, gameQueueAccountOne: gameQueueAccountThree, gameQueueAccountTwo: gameQueueAccountFour } = await initTwoPlayerQueue(program, provider, gameAccount);

    const { playerAccount: playerAccountEight } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFour, playerAccountSeven);
    const { playerAccount: playerAccountNine } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFour, playerAccountEight);

    const p77 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p87 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p97 = await program.account.player.fetch(playerAccountNine.publicKey);
    const q37 = await program.account.gameQueue.fetch(gameQueueAccountThree.publicKey);
    const q47 = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);

    // Assert queues were set up correctly
    assert.equal(p87.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(p77.nextPlayer, null);
    assert.equal(p97.nextPlayer, null);
    assert.equal(q37.currentPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q47.currentPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q37.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q47.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q37.numPlayersInQueue.toNumber(), 1);
    assert.equal(q47.numPlayersInQueue.toNumber(), 2);

    const { updatedGameQueueOne: q38, updatedGameQueueTwo: q48 } = await advanceTwoPlayerKingOfHillQueue(program, provider, playerAccountEight, playerAccountSeven, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    const p88 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p98 = await program.account.player.fetch(playerAccountNine.publicKey);

    // Assert queues were set up correctly
    assert.equal(p88.nextPlayer, null);
    assert.equal(p98.nextPlayer, null);
    assert.equal(q38.currentPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q48.currentPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q38.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q48.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q38.numPlayersInQueue.toNumber(), 1);
    assert.equal(q48.numPlayersInQueue.toNumber(), 1);

    const { updatedGameQueueOne: q39, updatedGameQueueTwo: q49 } = await advanceTwoPlayerKingOfHillQueue(program, provider, playerAccountEight, playerAccountNine, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    const p89 = await program.account.player.fetch(playerAccountEight.publicKey);

    // Assert queues were set up correctly
    assert.equal(p89.nextPlayer, null);
    assert.equal(q39.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q49.currentPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q39.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q49.currentPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q39.numPlayersInQueue.toNumber(), 0);
    assert.equal(q49.numPlayersInQueue.toNumber(), 1);

    const { updatedGame: ug10 } = await finishTwoPlayerKingOfHillQueue(program, provider, playerAccountEight, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

    assert.equal(ug10.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(ug10.gameQueues[1].toString(), gameAccount.publicKey.toString());
  });
});
