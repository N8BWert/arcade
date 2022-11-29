import * as anchor from "@project-serum/anchor";
import { Program, ProgramErrorStack } from "@project-serum/anchor";
import { SplAssociatedTokenInstructionCoder } from "@project-serum/anchor/dist/cjs/coder/spl-associated-token/instruction";
import { SystemEventsCoder } from "@project-serum/anchor/dist/cjs/coder/system/events";
import { assert, AssertionError } from "chai";
import { Arcade } from "../target/types/arcade";

const { makeArcade } = require("./functions/makeArcade.js");
const { makeGame } = require("./functions/makeGame.js");
const { deleteRecentGame } = require("./functions/deleteRecentGame.js");
const { deleteGame } = require("./functions/deleteGame.js");
const { updateLeaderboard } = require("./functions/updateLeaderboard.js");
const { initOnePlayerQueue, initTwoPlayerQueue, initThreePlayerQueue, initFourPlayerQueue } = require("./functions/initQueue.js");
const { joinOnePlayerQueue, joinTwoPlayerQueue, joinThreePlayerQueue, joinFourPlayerQueue, joinKingOfHillQueue } = require("./functions/joinQueue.js");
const { advanceOnePlayerQueue, advanceTwoPlayerQueue, advanceTwoPlayerKingOfHillQueue, advanceThreePlayerQueue, advanceThreePlayerKingOfHillQueue,
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

  // 7 8 9 -> 7     ->       ->       ->       ->       ->          ->          ->
  // 4 5 6 -> 4 8 9 -> 7 8   ->       ->       ->       -> 13    14 ->          ->
  // 1 2 3 -> 1 5 6 -> 4 5 9 -> 4 8 7 -> 4 _ _ -> _ _ _ -> 10 11 12 -> 13 14 12 ->
  // =============================================================================
  //          ->       ->          ->          ->          ->       ->          ->
  //          ->       ->    18 19 ->          ->          ->       ->          -> 
  // __ 14 __ -> _ _ _ -> 15 16 17 -> 19 18 17 -> __ __ 17 -> _ _ _ -> 20 21 __ -> 
  // =============================================================================
  //
  //
  // _ _ _
  it("performs operations on a king of the hill 3 player queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 3 player game
    const numPlayers = 3;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree } = await initThreePlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountTwo } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountThree, playerAccountOne);
    const { playerAccount: playerAccountFour } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountOne, playerAccountOne);
    const { playerAccount: playerAccountFive } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountTwo);
    const { playerAccount: playerAccountSix } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountThree, playerAccountThree);
    const { playerAccount: playerAccountSeven } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountOne, playerAccountFour);
    const { playerAccount: playerAccountEight } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountFive);
    const { playerAccount: playerAccountNine } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountThree, playerAccountSix);

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
    const g0 = await program.account.game.fetch(gameAccount.publicKey);

    // Assert queues were created correctly
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
    assert.equal(g0.gameQueues[0].toString(), gameQueueAccountOne.publicKey.toString());
    assert.equal(g0.gameQueues[1].toString(), gameQueueAccountTwo.publicKey.toString());
    assert.equal(g0.gameQueues[2].toString(), gameQueueAccountThree.publicKey.toString());

    const { updatedGameQueueOne: q11, updatedGameQueueTwo: q21, updatedGameQueueThree: q31 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountOne, playerAccountTwo, playerAccountThree, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    const p11 = await program.account.player.fetch(playerAccountOne.publicKey);
    const p41 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p51 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p61 = await program.account.player.fetch(playerAccountSix.publicKey);
    const p71 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p81 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p91 = await program.account.player.fetch(playerAccountNine.publicKey);

    // Assert queues were advanced correctly
    assert.equal(p11.nextPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(p51.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(p61.nextPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(p41.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(p71.nextPlayer, null);
    assert.equal(p81.nextPlayer, null);
    assert.equal(p91.nextPlayer, null);
    assert.equal(q11.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(q21.currentPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q31.currentPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(q11.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q21.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q31.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q11.numPlayersInQueue.toNumber(), 3);
    assert.equal(q21.numPlayersInQueue.toNumber(), 2);
    assert.equal(q31.numPlayersInQueue.toNumber(), 2);

    const { updatedGameQueueOne: q12, updatedGameQueueTwo: q22, updatedGameQueueThree: q32 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountFive, playerAccountOne, playerAccountSix, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    const p42 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p52 = await program.account.player.fetch(playerAccountFive.publicKey);
    const p72 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p82 = await program.account.player.fetch(playerAccountEight.publicKey);
    const p92 = await program.account.player.fetch(playerAccountNine.publicKey);
    
    // Assert queues were advanced correctly
    assert.equal(p42.nextPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(p52.nextPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(p72.nextPlayer, null);
    assert.equal(p82.nextPlayer, null);
    assert.equal(p92.nextPlayer, null);
    assert.equal(q12.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q22.currentPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(q32.currentPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q12.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q22.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q32.lastPlayer.toString(), playerAccountNine.publicKey.toString());
    assert.equal(q12.numPlayersInQueue.toNumber(), 2);
    assert.equal(q22.numPlayersInQueue.toNumber(), 2);
    assert.equal(q32.numPlayersInQueue.toNumber(), 1);

    const { updatedGameQueueOne: q13, updatedGameQueueTwo: q23, updatedGameQueueThree: q33 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountFour, playerAccountFive, playerAccountNine, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    const p43 = await program.account.player.fetch(playerAccountFour.publicKey);
    const p73 = await program.account.player.fetch(playerAccountSeven.publicKey);
    const p83 = await program.account.player.fetch(playerAccountEight.publicKey);

    // Assert queues were advanced correctly
    assert.equal(p43.nextPlayer, null);
    assert.equal(p73.nextPlayer, null);
    assert.equal(p83.nextPlayer, null);
    assert.equal(q13.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q23.currentPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q33.currentPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q13.lastPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q23.lastPlayer.toString(), playerAccountEight.publicKey.toString());
    assert.equal(q33.lastPlayer.toString(), playerAccountSeven.publicKey.toString());
    assert.equal(q13.numPlayersInQueue.toNumber(), 1);
    assert.equal(q23.numPlayersInQueue.toNumber(), 1);
    assert.equal(q33.numPlayersInQueue.toNumber(), 1);

    const { updatedGameQueueOne: q14, updatedGameQueueTwo: q24, updatedGameQueueThree: q34 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountFour, playerAccountEight, playerAccountSeven, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    const p44 = await program.account.player.fetch(playerAccountFour.publicKey);

    // Assert queues were advanced correctly
    assert.equal(p44.nextPlayer, null);
    assert.equal(q14.currentPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q24.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q34.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q14.lastPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(q24.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q34.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q14.numPlayersInQueue.toNumber(), 1);
    assert.equal(q24.numPlayersInQueue.toNumber(), 0);
    assert.equal(q34.numPlayersInQueue.toNumber(), 0);

    const { updatedGame: g5 } = await finishThreePlayerKingOfHillQueue(program, provider, playerAccountFour, playerAccountFour, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameAccount);

    // Assert the game has been finished correctly
    assert.equal(g5.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(g5.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(g5.gameQueues[2].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountTen, gameQueueAccountOne: gameQueueAccountFour, gameQueueAccountTwo: gameQueueAccountFive, gameQueueAccountThree: gameQueueAccountSix } = await initThreePlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountEleven } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFive, playerAccountTen);
    const { playerAccount: playerAccountTwelve } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountSix, playerAccountTen);
    const { playerAccount: playerAccountThirteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFour, playerAccountTen);
    const { playerAccount: playerAccountFourteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountSix, playerAccountTwelve);

    const p106 = await program.account.player.fetch(playerAccountTen.publicKey);
    const p116 = await program.account.player.fetch(playerAccountEleven.publicKey);
    const p126 = await program.account.player.fetch(playerAccountTwelve.publicKey);
    const p136 = await program.account.player.fetch(playerAccountThirteen.publicKey);
    const p146 = await program.account.player.fetch(playerAccountFourteen.publicKey);
    const q46 = await program.account.gameQueue.fetch(gameQueueAccountFour.publicKey);
    const q56 = await program.account.gameQueue.fetch(gameQueueAccountFive.publicKey);
    const q66 = await program.account.gameQueue.fetch(gameQueueAccountSix.publicKey);
    const g6 = await program.account.game.fetch(gameAccount.publicKey);

    // Assert the queues have been set up correctly
    assert.equal(g6.gameQueues[0].toString(), gameQueueAccountFour.publicKey.toString());
    assert.equal(g6.gameQueues[1].toString(), gameQueueAccountFive.publicKey.toString());
    assert.equal(g6.gameQueues[2].toString(), gameQueueAccountSix.publicKey.toString());
    assert.equal(p106.nextPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(p126.nextPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(p136.nextPlayer, null);
    assert.equal(p146.nextPlayer, null);
    assert.equal(p116.nextPlayer, null);
    assert.equal(q46.currentPlayer.toString(), playerAccountTen.publicKey.toString());
    assert.equal(q56.currentPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(q66.currentPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(q46.lastPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(q56.lastPlayer.toString(), playerAccountEleven.publicKey.toString());
    assert.equal(q66.lastPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(q46.numPlayersInQueue.toNumber(), 2);
    assert.equal(q56.numPlayersInQueue.toNumber(), 1);
    assert.equal(q66.numPlayersInQueue.toNumber(), 2);

    const { updatedGameQueueOne: q47, updatedGameQueueTwo: q57, updatedGameQueueThree: q67 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountTwelve, playerAccountTen, playerAccountEleven, gameQueueAccountFour, gameQueueAccountFive, gameQueueAccountSix, gameAccount);

    const p137 = await program.account.player.fetch(playerAccountThirteen.publicKey);
    const p147 = await program.account.player.fetch(playerAccountFourteen.publicKey);
    const p127 = await program.account.player.fetch(playerAccountTwelve.publicKey);

    // Assert the queues have been advanced correctly
    assert.equal(p137.nextPlayer, null);
    assert.equal(p147.nextPlayer, null);
    assert.equal(p127.nextPlayer, null);
    assert.equal(q47.currentPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(q57.currentPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(q67.currentPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(q47.lastPlayer.toString(), playerAccountThirteen.publicKey.toString());
    assert.equal(q57.lastPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(q67.lastPlayer.toString(), playerAccountTwelve.publicKey.toString());
    assert.equal(q47.numPlayersInQueue.toNumber(), 1);
    assert.equal(q57.numPlayersInQueue.toNumber(), 1);
    assert.equal(q67.numPlayersInQueue.toNumber(), 1);

    const { updatedGameQueueOne: q48, updatedGameQueueTwo: q58, updatedGameQueueThree: q68 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountFourteen, playerAccountThirteen, playerAccountTwelve, gameQueueAccountFour, gameQueueAccountFive, gameQueueAccountSix, gameAccount);

    const p148 = await program.account.player.fetch(playerAccountFourteen.publicKey);

    // Assert the queues have been advanced correctly
    assert.equal(p148.nextPlayer, null);
    assert.equal(q48.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q58.currentPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(q68.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q48.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q58.lastPlayer.toString(), playerAccountFourteen.publicKey.toString());
    assert.equal(q68.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q48.numPlayersInQueue.toNumber(), 0);
    assert.equal(q58.numPlayersInQueue.toNumber(), 1);
    assert.equal(q68.numPlayersInQueue.toNumber(), 0);

    const { updatedGame: g9 } = await finishThreePlayerKingOfHillQueue(program, provider, playerAccountFourteen, playerAccountFourteen, gameQueueAccountFour, gameQueueAccountFive, gameQueueAccountSix, gameAccount);

    // Assert the game has been finished correctly
    assert.equal(g9.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(g9.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(g9.gameQueues[2].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountFifteen, gameQueueAccountOne: gameQueueAccountSeven, gameQueueAccountTwo: gameQueueAccountEight, gameQueueAccountThree: gameQueueAccountNine } = await initThreePlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountSixteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountEight, playerAccountFifteen);
    const { playerAccount: playerAccountSeventeen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountNine, playerAccountFifteen);
    const { playerAccount: playerAccountEighteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountEight, playerAccountSixteen);
    const { playerAccount: playerAccountNineteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountNine, playerAccountSeventeen);

    const g10 = await program.account.game.fetch(gameAccount.publicKey);
    const p1510 = await program.account.player.fetch(playerAccountFifteen.publicKey);
    const p1610 = await program.account.player.fetch(playerAccountSixteen.publicKey);
    const p1710 = await program.account.player.fetch(playerAccountSeventeen.publicKey);
    const p1810 = await program.account.player.fetch(playerAccountEighteen.publicKey);
    const p1910 = await program.account.player.fetch(playerAccountNineteen.publicKey);
    const q710 = await program.account.gameQueue.fetch(gameQueueAccountSeven.publicKey);
    const q810 = await program.account.gameQueue.fetch(gameQueueAccountEight.publicKey);
    const q910 = await program.account.gameQueue.fetch(gameQueueAccountNine.publicKey);

    // Assert the queues have been set up correctly
    assert.equal(g10.gameQueues[0].toString(), gameQueueAccountSeven.publicKey.toString());
    assert.equal(g10.gameQueues[1].toString(), gameQueueAccountEight.publicKey.toString());
    assert.equal(g10.gameQueues[2].toString(), gameQueueAccountNine.publicKey.toString());
    assert.equal(p1510.nextPlayer, null);
    assert.equal(p1810.nextPlayer, null);
    assert.equal(p1910.nextPlayer, null);
    assert.equal(p1610.nextPlayer.toString(), playerAccountEighteen.publicKey.toString());
    assert.equal(p1710.nextPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(q710.currentPlayer.toString(), playerAccountFifteen.publicKey.toString());
    assert.equal(q810.currentPlayer.toString(), playerAccountSixteen.publicKey.toString());
    assert.equal(q910.currentPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q710.lastPlayer.toString(), playerAccountFifteen.publicKey.toString());
    assert.equal(q810.lastPlayer.toString(), playerAccountEighteen.publicKey.toString());
    assert.equal(q910.lastPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(q710.numPlayersInQueue.toNumber(), 1);
    assert.equal(q810.numPlayersInQueue.toNumber(), 2);
    assert.equal(q910.numPlayersInQueue.toNumber(), 2);

    const { updatedGameQueueOne: q711, updatedGameQueueTwo: q811, updatedGameQueueThree: q911 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountSeventeen, playerAccountFifteen, playerAccountSixteen, gameQueueAccountSeven, gameQueueAccountEight, gameQueueAccountNine, gameAccount);

    const p1911 = await program.account.player.fetch(playerAccountNineteen.publicKey);
    const p1811 = await program.account.player.fetch(playerAccountEighteen.publicKey);
    const p1711 = await program.account.player.fetch(playerAccountNineteen.publicKey);

    // Assert the queues have been advanced correctly
    assert.equal(p1911.nextPlayer, null);
    assert.equal(p1811.nextPlayer, null);
    assert.equal(p1711.nextPlayer, null);
    assert.equal(q711.currentPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(q811.currentPlayer.toString(), playerAccountEighteen.publicKey.toString());
    assert.equal(q911.currentPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q711.lastPlayer.toString(), playerAccountNineteen.publicKey.toString());
    assert.equal(q811.lastPlayer.toString(), playerAccountEighteen.publicKey.toString());
    assert.equal(q911.lastPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q711.numPlayersInQueue.toNumber(), 1);
    assert.equal(q811.numPlayersInQueue.toNumber(), 1);
    assert.equal(q911.numPlayersInQueue.toNumber(), 1);

    const { updatedGameQueueOne: q712, updatedGameQueueTwo: q812, updatedGameQueueThree: q912 } = await advanceThreePlayerKingOfHillQueue(program, provider, playerAccountSeventeen, playerAccountEighteen, playerAccountNineteen, gameQueueAccountSeven, gameQueueAccountEight, gameQueueAccountNine, gameAccount);

    const p1712 = await program.account.player.fetch(playerAccountSeventeen.publicKey);

    // Assert the queues have been advanced correctly
    assert.equal(p1712.nextPlayer, null);
    assert.equal(q712.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q812.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q912.currentPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q712.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q812.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q912.lastPlayer.toString(), playerAccountSeventeen.publicKey.toString());
    assert.equal(q712.numPlayersInQueue.toNumber(), 0);
    assert.equal(q812.numPlayersInQueue.toNumber(), 0);
    assert.equal(q912.numPlayersInQueue.toNumber(), 1);

    const { updatedGame: g13 } = await finishThreePlayerKingOfHillQueue(program, provider, playerAccountSeventeen, playerAccountSeventeen, gameQueueAccountSeven, gameQueueAccountEight, gameQueueAccountNine, gameAccount);

    // Assert the queues have been tore down correctly
    assert.equal(g13.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(g13.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(g13.gameQueues[2].toString(), gameAccount.publicKey.toString());

    const { playerAccount: playerAccountTwenty, gameQueueAccountOne: gameQueueAccountTen, gameQueueAccountTwo: gameQueueAccountEleven, gameQueueAccountThree: gameQueueAccountTwelve } = await initThreePlayerQueue(program, provider, gameAccount);
    const { playerAccount: playerAccountTwentyOne } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountEleven, playerAccountTwenty);

    const g14 = await program.account.game.fetch(gameAccount.publicKey);
    const p2014 = await program.account.player.fetch(playerAccountTwenty.publicKey);
    const p2114 = await program.account.player.fetch(playerAccountTwentyOne.publicKey);
    const q1014 = await program.account.gameQueue.fetch(gameQueueAccountTen.publicKey);
    const q1114 = await program.account.gameQueue.fetch(gameQueueAccountEleven.publicKey);
    const q1214 = await program.account.gameQueue.fetch(gameQueueAccountTwelve.publicKey);

    // Assert the queues have been set up correctly
    assert.equal(g14.gameQueues[0].toString(), gameQueueAccountTen.publicKey.toString());
    assert.equal(g14.gameQueues[0].toString(), gameQueueAccountTen.publicKey.toString());
    assert.equal(g14.gameQueues[0].toString(), gameQueueAccountTen.publicKey.toString());
    assert.equal(p2014.nextPlayer, null);
    assert.equal(p2114.nextPlayer, null);
    assert.equal(q1014.currentPlayer.toString(), playerAccountTwenty.publicKey.toString());
    assert.equal(q1114.currentPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q1214.currentPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1014.lastPlayer.toString(), playerAccountTwenty.publicKey.toString());
    assert.equal(q1114.lastPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
    assert.equal(q1214.lastPlayer.toString(), gameAccount.publicKey.toString());
    assert.equal(q1014.numPlayersInQueue.toNumber(), 1);
    assert.equal(q1114.numPlayersInQueue.toNumber(), 1);
    assert.equal(q1214.numPlayersInQueue.toNumber(), 0);

    const { updatedGame: g15 } = await finishThreePlayerKingOfHillQueue(program, provider, playerAccountTwenty, playerAccountTwentyOne, gameQueueAccountTen, gameQueueAccountEleven, gameQueueAccountTwelve, gameAccount);

    // Assert the queues have been tore down correctly
    assert.equal(g15.gameQueues[0].toString(), gameAccount.publicKey.toString());
    assert.equal(g15.gameQueues[1].toString(), gameAccount.publicKey.toString());
    assert.equal(g15.gameQueues[2].toString(), gameAccount.publicKey.toString());
  });

  // 9 10 11 12 -> 9          ->            ->           ->         ->         ->             ->
  // 5  6  7  8 -> 5 10 11 12 -> 9 10       ->           ->         ->         -> 17    18 19 ->
  // 1  2  3  4 -> 1  6  7  8 -> 5  6 11 12 -> 5 10 9 __ -> 5 _ _ _ -> _ _ _ _ -> 13 14 15 16 ->
  // ===========================================================================================
  //             ->          ->         ->             ->             ->          ->         ->
  //             ->          ->         -> 24 25    26 ->             ->          ->         ->
  // 17 18 15 19 -> _ 18 _ _ -> _ _ _ _ -> 20 21 22 23 -> 24 25 26 23 -> _ _ 26 _ -> _ _ _ _ ->
  // ===========================================================================================
  //           ->         ->            ->        
  //           ->         ->            ->        
  // 27 28 _ _ -> _ _ _ _ -> 29 30 31 _ -> _ _ _ _
  it("performs operations on a king of the hill 4 player queue", async () => {
        // Create an arcade
        const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

        // Create global parameters for a king of the hill 3 player game
        const numPlayers = 4;
        const gameType = 1;
    
        const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

        const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour } = await initFourPlayerQueue(program, provider, gameAccount);
        const { playerAccount: playerAccountTwo } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountOne);
        const { playerAccount: playerAccountThree } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountThree, playerAccountOne);
        const { playerAccount: playerAccountFour } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFour, playerAccountOne);
        const { playerAccount: playerAccountFive } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountOne, playerAccountOne);
        const { playerAccount: playerAccountSix } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountTwo);
        const { playerAccount: playerAccountSeven } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountThree, playerAccountThree);
        const { playerAccount: playerAccountEight } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFour, playerAccountFour);
        const { playerAccount: playerAccountNine } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountOne, playerAccountFive);
        const { playerAccount: playerAccountTen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwo, playerAccountSix);
        const { playerAccount: playerAccountEleven } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountThree, playerAccountSeven);
        const { playerAccount: playerAccountTwelve } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFour, playerAccountEight);

        const g0 = await program.account.game.fetch(gameAccount.publicKey);
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

        // Assert the queues were created correctly
        assert.equal(g0.gameQueues[0].toString(), gameQueueAccountOne.publicKey.toString());
        assert.equal(g0.gameQueues[1].toString(), gameQueueAccountTwo.publicKey.toString());
        assert.equal(g0.gameQueues[2].toString(), gameQueueAccountThree.publicKey.toString());
        assert.equal(g0.gameQueues[3].toString(), gameQueueAccountFour.publicKey.toString());
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

        const { updatedGameQueueOne: q11, updatedGameQueueTwo: q21, updatedGameQueueThree: q31, updatedGameQueueFour: q41 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountOne, playerAccountTwo, playerAccountThree, playerAccountFour, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

        const p11 = await program.account.player.fetch(playerAccountOne.publicKey);
        const p51 = await program.account.player.fetch(playerAccountFive.publicKey);
        const p61 = await program.account.player.fetch(playerAccountSix.publicKey);
        const p71 = await program.account.player.fetch(playerAccountSeven.publicKey);
        const p81 = await program.account.player.fetch(playerAccountEight.publicKey);
        const p91 = await program.account.player.fetch(playerAccountNine.publicKey);
        const p101 = await program.account.player.fetch(playerAccountTen.publicKey);
        const p111 = await program.account.player.fetch(playerAccountEleven.publicKey);
        const p121 = await program.account.player.fetch(playerAccountTwelve.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p11.nextPlayer.toString(), playerAccountFive.publicKey.toString());
        assert.equal(p61.nextPlayer.toString(), playerAccountTen.publicKey.toString());
        assert.equal(p71.nextPlayer.toString(), playerAccountEleven.publicKey.toString());
        assert.equal(p81.nextPlayer.toString(), playerAccountTwelve.publicKey.toString());
        assert.equal(p51.nextPlayer.toString(), playerAccountNine.publicKey.toString());
        assert.equal(p101.nextPlayer, null);
        assert.equal(p111.nextPlayer, null);
        assert.equal(p121.nextPlayer, null);
        assert.equal(p91.nextPlayer, null);
        assert.equal(q11.currentPlayer.toString(), playerAccountOne.publicKey.toString());
        assert.equal(q21.currentPlayer.toString(), playerAccountSix.publicKey.toString());
        assert.equal(q31.currentPlayer.toString(), playerAccountSeven.publicKey.toString());
        assert.equal(q41.currentPlayer.toString(), playerAccountEight.publicKey.toString());
        assert.equal(q11.lastPlayer.toString(), playerAccountNine.publicKey.toString());
        assert.equal(q21.lastPlayer.toString(), playerAccountTen.publicKey.toString());
        assert.equal(q31.lastPlayer.toString(), playerAccountEleven.publicKey.toString());
        assert.equal(q41.lastPlayer.toString(), playerAccountTwelve.publicKey.toString());
        assert.equal(q11.numPlayersInQueue.toNumber(), 3);
        assert.equal(q21.numPlayersInQueue.toNumber(), 2);
        assert.equal(q31.numPlayersInQueue.toNumber(), 2);
        assert.equal(q41.numPlayersInQueue.toNumber(), 2);

        const { updatedGameQueueOne: q12, updatedGameQueueTwo: q22, updatedGameQueueThree: q32, updatedGameQueueFour: q42 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountSix, playerAccountOne, playerAccountSeven, playerAccountEight, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

        const p52 = await program.account.player.fetch(playerAccountFive.publicKey);
        const p62 = await program.account.player.fetch(playerAccountSix.publicKey);
        const p92 = await program.account.player.fetch(playerAccountNine.publicKey);
        const p102 = await program.account.player.fetch(playerAccountTen.publicKey);
        const p112 = await program.account.player.fetch(playerAccountEleven.publicKey);
        const p122 = await program.account.player.fetch(playerAccountTwelve.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p52.nextPlayer.toString(), playerAccountNine.publicKey.toString());
        assert.equal(p62.nextPlayer.toString(), playerAccountTen.publicKey.toString());
        assert.equal(p92.nextPlayer, null);
        assert.equal(p102.nextPlayer, null);
        assert.equal(p112.nextPlayer, null);
        assert.equal(p122.nextPlayer, null);
        assert.equal(q12.currentPlayer.toString(), playerAccountFive.publicKey.toString());
        assert.equal(q22.currentPlayer.toString(), playerAccountSix.publicKey.toString());
        assert.equal(q32.currentPlayer.toString(), playerAccountEleven.publicKey.toString());
        assert.equal(q42.currentPlayer.toString(), playerAccountTwelve.publicKey.toString());
        assert.equal(q12.lastPlayer.toString(), playerAccountNine.publicKey.toString());
        assert.equal(q22.lastPlayer.toString(), playerAccountTen.publicKey.toString());
        assert.equal(q32.lastPlayer.toString(), playerAccountEleven.publicKey.toString());
        assert.equal(q42.lastPlayer.toString(), playerAccountTwelve.publicKey.toString());
        assert.equal(q12.numPlayersInQueue.toNumber(), 2);
        assert.equal(q22.numPlayersInQueue.toNumber(), 2);
        assert.equal(q32.numPlayersInQueue.toNumber(), 1);
        assert.equal(q42.numPlayersInQueue.toNumber(), 1);

        const { updatedGameQueueOne: q13, updatedGameQueueTwo: q23, updatedGameQueueThree: q33, updatedGameQueueFour: q43 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountFive, playerAccountSix, playerAccountEleven, playerAccountTwelve, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

        const p53 = await program.account.player.fetch(playerAccountFive.publicKey);
        const p103 = await program.account.player.fetch(playerAccountTen.publicKey);
        const p93 = await program.account.player.fetch(playerAccountNine.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p53.nextPlayer, null);
        assert.equal(p103.nextPlayer, null);
        assert.equal(p93.nextPlayer, null);
        assert.equal(q13.currentPlayer.toString(), playerAccountFive.publicKey.toString());
        assert.equal(q23.currentPlayer.toString(), playerAccountTen.publicKey.toString());
        assert.equal(q33.currentPlayer.toString(), playerAccountNine.publicKey.toString());
        assert.equal(q43.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q13.lastPlayer.toString(), playerAccountFive.publicKey.toString());
        assert.equal(q23.lastPlayer.toString(), playerAccountTen.publicKey.toString());
        assert.equal(q33.lastPlayer.toString(), playerAccountNine.publicKey.toString());
        assert.equal(q43.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q13.numPlayersInQueue.toNumber(), 1);
        assert.equal(q23.numPlayersInQueue.toNumber(), 1);
        assert.equal(q33.numPlayersInQueue.toNumber(), 1);
        assert.equal(q43.numPlayersInQueue.toNumber(), 0);

        const { updatedGameQueueOne: q14, updatedGameQueueTwo: q24, updatedGameQueueThree: q34, updatedGameQueueFour: q44 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountFive, playerAccountTen, playerAccountNine, playerAccountTen, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

        const p54 = await program.account.player.fetch(playerAccountFive.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p54.nextPlayer, null);
        assert.equal(q14.currentPlayer.toString(), playerAccountFive.publicKey.toString());
        assert.equal(q24.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q34.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q44.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q14.lastPlayer.toString(), playerAccountFive.publicKey.toString());
        assert.equal(q24.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q34.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q44.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q14.numPlayersInQueue.toNumber(), 1);
        assert.equal(q24.numPlayersInQueue.toNumber(), 0);
        assert.equal(q34.numPlayersInQueue.toNumber(), 0);
        assert.equal(q44.numPlayersInQueue.toNumber(), 0);

        const { updatedGame: g5 } = await finishFourPlayerKingOfHillQueue(program, provider, playerAccountFive, playerAccountFive, playerAccountFive, gameQueueAccountOne, gameQueueAccountTwo, gameQueueAccountThree, gameQueueAccountFour, gameAccount);

        // Assert queues were torn down correctly
        assert.equal(g5.gameQueues[0].toString(), gameAccount.publicKey.toString());
        assert.equal(g5.gameQueues[1].toString(), gameAccount.publicKey.toString());
        assert.equal(g5.gameQueues[2].toString(), gameAccount.publicKey.toString());
        assert.equal(g5.gameQueues[3].toString(), gameAccount.publicKey.toString());

        const { playerAccount: playerAccountThirteen, gameQueueAccountOne: gameQueueAccountFive, gameQueueAccountTwo: gameQueueAccountSix, gameQueueAccountThree: gameQueueAccountSeven, gameQueueAccountFour: gameQueueAccountEight } = await initFourPlayerQueue(program, provider, gameAccount);
        const { playerAccount: playerAccountFourteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountSix, playerAccountThirteen);
        const { playerAccount: playerAccountFifteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountSeven, playerAccountThirteen);
        const { playerAccount: playerAccountSixteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountEight, playerAccountThirteen);
        const { playerAccount: playerAccountSeventeen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFive, playerAccountThirteen);
        const { playerAccount: playerAccountEighteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountSeven, playerAccountFifteen);
        const { playerAccount: playerAccountNineteen } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountEight, playerAccountSixteen);

        const g6 = await program.account.game.fetch(gameAccount.publicKey);
        const p136 = await program.account.player.fetch(playerAccountThirteen.publicKey);
        const p146 = await program.account.player.fetch(playerAccountFourteen.publicKey);
        const p156 = await program.account.player.fetch(playerAccountFifteen.publicKey);
        const p166 = await program.account.player.fetch(playerAccountSixteen.publicKey);
        const p176 = await program.account.player.fetch(playerAccountSeventeen.publicKey);
        const p186 = await program.account.player.fetch(playerAccountEighteen.publicKey);
        const p196 = await program.account.player.fetch(playerAccountNineteen.publicKey);
        const q56 = await program.account.gameQueue.fetch(gameQueueAccountFive.publicKey);
        const q66 = await program.account.gameQueue.fetch(gameQueueAccountSix.publicKey);
        const q76 = await program.account.gameQueue.fetch(gameQueueAccountSeven.publicKey);
        const q86 = await program.account.gameQueue.fetch(gameQueueAccountEight.publicKey);

        // Assert queues were set up correctly
        assert.equal(g6.gameQueues[0].toString(), gameQueueAccountFive.publicKey.toString());
        assert.equal(g6.gameQueues[1].toString(), gameQueueAccountSix.publicKey.toString());
        assert.equal(g6.gameQueues[2].toString(), gameQueueAccountSeven.publicKey.toString());
        assert.equal(g6.gameQueues[3].toString(), gameQueueAccountEight.publicKey.toString());
        assert.equal(p136.nextPlayer.toString(), playerAccountSeventeen.publicKey.toString());
        assert.equal(p156.nextPlayer.toString(), playerAccountEighteen.publicKey.toString());
        assert.equal(p166.nextPlayer.toString(), playerAccountNineteen.publicKey.toString());
        assert.equal(p176.nextPlayer, null);
        assert.equal(p146.nextPlayer, null);
        assert.equal(p186.nextPlayer, null);
        assert.equal(p196.nextPlayer, null);
        assert.equal(q56.currentPlayer.toString(), playerAccountThirteen.publicKey.toString());
        assert.equal(q66.currentPlayer.toString(), playerAccountFourteen.publicKey.toString());
        assert.equal(q76.currentPlayer.toString(), playerAccountFifteen.publicKey.toString());
        assert.equal(q86.currentPlayer.toString(), playerAccountSixteen.publicKey.toString());
        assert.equal(q56.lastPlayer.toString(), playerAccountSeventeen.publicKey.toString());
        assert.equal(q66.lastPlayer.toString(), playerAccountFourteen.publicKey.toString());
        assert.equal(q76.lastPlayer.toString(), playerAccountEighteen.publicKey.toString());
        assert.equal(q86.lastPlayer.toString(), playerAccountNineteen.publicKey.toString());
        assert.equal(q56.numPlayersInQueue.toNumber(), 2);
        assert.equal(q66.numPlayersInQueue.toNumber(), 1);
        assert.equal(q76.numPlayersInQueue.toNumber(), 2);
        assert.equal(q86.numPlayersInQueue.toNumber(), 2);

        const { updatedGameQueueOne: q57, updatedGameQueueTwo: q67, updatedGameQueueThree: q77, updatedGameQueueFour: q87 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountFifteen, playerAccountThirteen, playerAccountFourteen, playerAccountSixteen, gameQueueAccountFive, gameQueueAccountSix, gameQueueAccountSeven, gameQueueAccountEight, gameAccount);

        const p177 = await program.account.player.fetch(playerAccountSeventeen.publicKey);
        const p187 = await program.account.player.fetch(playerAccountEighteen.publicKey);
        const p157 = await program.account.player.fetch(playerAccountFifteen.publicKey);
        const p197 = await program.account.player.fetch(playerAccountNineteen.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p177.nextPlayer, null);
        assert.equal(p187.nextPlayer, null);
        assert.equal(p157.nextPlayer, null);
        assert.equal(p197.nextPlayer, null);
        assert.equal(q57.currentPlayer.toString(), playerAccountSeventeen.publicKey.toString());
        assert.equal(q67.currentPlayer.toString(), playerAccountEighteen.publicKey.toString());
        assert.equal(q77.currentPlayer.toString(), playerAccountFifteen.publicKey.toString());
        assert.equal(q87.currentPlayer.toString(), playerAccountNineteen.publicKey.toString());
        assert.equal(q57.lastPlayer.toString(), playerAccountSeventeen.publicKey.toString());
        assert.equal(q67.lastPlayer.toString(), playerAccountEighteen.publicKey.toString());
        assert.equal(q77.lastPlayer.toString(), playerAccountFifteen.publicKey.toString());
        assert.equal(q87.lastPlayer.toString(), playerAccountNineteen.publicKey.toString());
        assert.equal(q57.numPlayersInQueue.toNumber(), 1);
        assert.equal(q67.numPlayersInQueue.toNumber(), 1);
        assert.equal(q77.numPlayersInQueue.toNumber(), 1);
        assert.equal(q87.numPlayersInQueue.toNumber(), 1);

        const { updatedGameQueueOne: q58, updatedGameQueueTwo: q68, updatedGameQueueThree: q78, updatedGameQueueFour: q88 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountEighteen, playerAccountSeventeen, playerAccountFifteen, playerAccountNineteen, gameQueueAccountFive, gameQueueAccountSix, gameQueueAccountSeven, gameQueueAccountEight, gameAccount);

        const p188 = await program.account.player.fetch(playerAccountEighteen.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p188.nextPlayer, null);
        assert.equal(q58.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q68.currentPlayer.toString(), playerAccountEighteen.publicKey.toString());
        assert.equal(q78.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q88.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q58.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q68.lastPlayer.toString(), playerAccountEighteen.publicKey.toString());
        assert.equal(q78.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q88.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q58.numPlayersInQueue.toNumber(), 0);
        assert.equal(q68.numPlayersInQueue.toNumber(), 1);
        assert.equal(q78.numPlayersInQueue.toNumber(), 0);
        assert.equal(q88.numPlayersInQueue.toNumber(), 0);

        const { updatedGame: g8 } = await finishFourPlayerKingOfHillQueue(program, provider, playerAccountEighteen, playerAccountEighteen, playerAccountEighteen, gameQueueAccountFive, gameQueueAccountSix, gameQueueAccountSeven, gameQueueAccountEight, gameAccount);

        // Assert queues were torn down correctly
        assert.equal(g8.gameQueues[0].toString(), gameAccount.publicKey.toString());
        assert.equal(g8.gameQueues[1].toString(), gameAccount.publicKey.toString());
        assert.equal(g8.gameQueues[2].toString(), gameAccount.publicKey.toString());
        assert.equal(g8.gameQueues[3].toString(), gameAccount.publicKey.toString());

        const { playerAccount: playerAccountTwenty, gameQueueAccountOne: gameQueueAccountNine, gameQueueAccountTwo: gameQueueAccountTen, gameQueueAccountThree: gameQueueAccountEleven, gameQueueAccountFour: gameQueueAccountTwelve } = await initFourPlayerQueue(program, provider, gameAccount);
        const { playerAccount: playerAccountTwentyOne } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTen, playerAccountTwenty);
        const { playerAccount: playerAccountTwentyTwo } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountEleven, playerAccountTwenty);
        const { playerAccount: playerAccountTwentyThree } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwelve, playerAccountTwenty);
        const { playerAccount: playerAccountTwentyFour } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountNine, playerAccountTwenty);
        const { playerAccount: playerAccountTwentyFive } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTen, playerAccountTwentyOne);
        const { playerAccount: playerAccountTwentySix } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountTwelve, playerAccountTwentyThree);

        const g9 = await program.account.game.fetch(gameAccount.publicKey);
        const p209 = await program.account.player.fetch(playerAccountTwenty.publicKey);
        const p219 = await program.account.player.fetch(playerAccountTwentyOne.publicKey);
        const p229 = await program.account.player.fetch(playerAccountTwentyTwo.publicKey);
        const p239 = await program.account.player.fetch(playerAccountTwentyThree.publicKey);
        const p249 = await program.account.player.fetch(playerAccountTwentyFour.publicKey);
        const p259 = await program.account.player.fetch(playerAccountTwentyFive.publicKey);
        const p269 = await program.account.player.fetch(playerAccountTwentySix.publicKey);
        const q99 = await program.account.gameQueue.fetch(gameQueueAccountNine.publicKey);
        const q109 = await program.account.gameQueue.fetch(gameQueueAccountTen.publicKey);
        const q119 = await program.account.gameQueue.fetch(gameQueueAccountEleven.publicKey);
        const q129 = await program.account.gameQueue.fetch(gameQueueAccountTwelve.publicKey);

        // Assert queues were created correctly
        assert.equal(g9.gameQueues[0].toString(), gameQueueAccountNine.publicKey.toString());
        assert.equal(g9.gameQueues[1].toString(), gameQueueAccountTen.publicKey.toString());
        assert.equal(g9.gameQueues[2].toString(), gameQueueAccountEleven.publicKey.toString());
        assert.equal(g9.gameQueues[3].toString(), gameQueueAccountTwelve.publicKey.toString());
        assert.equal(p209.nextPlayer.toString(), playerAccountTwentyFour.publicKey.toString());
        assert.equal(p219.nextPlayer.toString(), playerAccountTwentyFive.publicKey.toString());
        assert.equal(p239.nextPlayer.toString(), playerAccountTwentySix.publicKey.toString());
        assert.equal(p249.nextPlayer, null);
        assert.equal(p259.nextPlayer, null);
        assert.equal(p229.nextPlayer, null);
        assert.equal(p269.nextPlayer, null);
        assert.equal(q99.currentPlayer.toString(), playerAccountTwenty.publicKey.toString());
        assert.equal(q109.currentPlayer.toString(), playerAccountTwentyOne.publicKey.toString());
        assert.equal(q119.currentPlayer.toString(), playerAccountTwentyTwo.publicKey.toString());
        assert.equal(q129.currentPlayer.toString(), playerAccountTwentyThree.publicKey.toString());
        assert.equal(q99.lastPlayer.toString(), playerAccountTwentyFour.publicKey.toString());
        assert.equal(q109.lastPlayer.toString(), playerAccountTwentyFive.publicKey.toString());
        assert.equal(q119.lastPlayer.toString(), playerAccountTwentyTwo.publicKey.toString());
        assert.equal(q129.lastPlayer.toString(), playerAccountTwentySix.publicKey.toString());
        assert.equal(q99.numPlayersInQueue.toNumber(), 2);
        assert.equal(q109.numPlayersInQueue.toNumber(), 2);
        assert.equal(q119.numPlayersInQueue.toNumber(), 1);
        assert.equal(q129.numPlayersInQueue.toNumber(), 2);

        const { updatedGameQueueOne: q910, updatedGameQueueTwo: q1010, updatedGameQueueThree: q1110, updatedGameQueueFour: q1210 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountTwentyThree, playerAccountTwenty, playerAccountTwentyOne, playerAccountTwentyTwo, gameQueueAccountNine, gameQueueAccountTen, gameQueueAccountEleven, gameQueueAccountTwelve, gameAccount);

        const p2410 = await program.account.player.fetch(playerAccountTwentyFour.publicKey);
        const p2510 = await program.account.player.fetch(playerAccountTwentyFive.publicKey);
        const p2610 = await program.account.player.fetch(playerAccountTwentySix.publicKey);
        const p2310 = await program.account.player.fetch(playerAccountTwentyThree.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p2410.nextPlayer, null);
        assert.equal(p2510.nextPlayer, null);
        assert.equal(p2610.nextPlayer, null);
        assert.equal(p2310.nextPlayer, null);
        assert.equal(q910.currentPlayer.toString(), playerAccountTwentyFour.publicKey.toString());
        assert.equal(q1010.currentPlayer.toString(), playerAccountTwentyFive.publicKey.toString());
        assert.equal(q1110.currentPlayer.toString(), playerAccountTwentySix.publicKey.toString());
        assert.equal(q1210.currentPlayer.toString(), playerAccountTwentyThree.publicKey.toString());
        assert.equal(q910.lastPlayer.toString(), playerAccountTwentyFour.publicKey.toString());
        assert.equal(q1010.lastPlayer.toString(), playerAccountTwentyFive.publicKey.toString());
        assert.equal(q1110.lastPlayer.toString(), playerAccountTwentySix.publicKey.toString());
        assert.equal(q1210.lastPlayer.toString(), playerAccountTwentyThree.publicKey.toString());
        assert.equal(q910.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1010.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1110.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1210.numPlayersInQueue.toNumber(), 1);

        const { updatedGameQueueOne: q911, updatedGameQueueTwo: q1011, updatedGameQueueThree: q1111, updatedGameQueueFour: q1211 } = await advanceFourPlayerKingOfHillQueue(program, provider, playerAccountTwentySix, playerAccountTwentyFour, playerAccountTwentyFive, playerAccountTwentyThree, gameQueueAccountNine, gameQueueAccountTen, gameQueueAccountEleven, gameQueueAccountTwelve, gameAccount);

        const p2611 = await program.account.player.fetch(playerAccountTwentySix.publicKey);

        // Assert queues were advanced correctly
        assert.equal(p2611.nextPlayer, null);
        assert.equal(q911.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1011.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1111.currentPlayer.toString(), playerAccountTwentySix.publicKey.toString());
        assert.equal(q1211.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q911.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1011.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1111.lastPlayer.toString(), playerAccountTwentySix.publicKey.toString());
        assert.equal(q1211.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q911.numPlayersInQueue.toNumber(), 0);
        assert.equal(q1011.numPlayersInQueue.toNumber(), 0);
        assert.equal(q1111.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1211.numPlayersInQueue.toNumber(), 0);

        const {updatedGame: g12 } = await finishFourPlayerKingOfHillQueue(program, provider, playerAccountTwentySix, playerAccountTwentySix, playerAccountTwentySix, gameQueueAccountNine, gameQueueAccountTen, gameQueueAccountEleven, gameQueueAccountTwelve, gameAccount);

        // Assert queues were torn down correctly
        assert.equal(g12.gameQueues[0].toString(), gameAccount.publicKey.toString());
        assert.equal(g12.gameQueues[1].toString(), gameAccount.publicKey.toString());
        assert.equal(g12.gameQueues[2].toString(), gameAccount.publicKey.toString());
        assert.equal(g12.gameQueues[3].toString(), gameAccount.publicKey.toString());

        const { playerAccount: playerAccountTwentySeven, gameQueueAccountOne: gameQueueAccountThirteen, gameQueueAccountTwo: gameQueueAccountFourteen, gameQueueAccountThree: gameQueueAccountFifteen, gameQueueAccountFour: gameQueueAccountSixteen } = await initFourPlayerQueue(program, provider, gameAccount);
        const { playerAccount: playerAccountTwentyEight } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountFourteen, playerAccountTwentySeven);

        const g13 = await program.account.game.fetch(gameAccount.publicKey);
        const p2713 = await program.account.player.fetch(playerAccountTwentySeven.publicKey);
        const p2813 = await program.account.player.fetch(playerAccountTwentyEight.publicKey);
        const q1313 = await program.account.gameQueue.fetch(gameQueueAccountThirteen.publicKey);
        const q1413 = await program.account.gameQueue.fetch(gameQueueAccountFourteen.publicKey);
        const q1513 = await program.account.gameQueue.fetch(gameQueueAccountFifteen.publicKey);
        const q1613 = await program.account.gameQueue.fetch(gameQueueAccountSixteen.publicKey);

        // Assert queues were set up correctly
        assert.equal(g13.gameQueues[0].toString(), gameQueueAccountThirteen.publicKey.toString());
        assert.equal(g13.gameQueues[1].toString(), gameQueueAccountFourteen.publicKey.toString());
        assert.equal(g13.gameQueues[2].toString(), gameQueueAccountFifteen.publicKey.toString());
        assert.equal(g13.gameQueues[3].toString(), gameQueueAccountSixteen.publicKey.toString());
        assert.equal(p2713.nextPlayer, null);
        assert.equal(p2813.nextPlayer, null);
        assert.equal(q1313.currentPlayer.toString(), playerAccountTwentySeven.publicKey.toString());
        assert.equal(q1413.currentPlayer.toString(), playerAccountTwentyEight.publicKey.toString());
        assert.equal(q1513.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1613.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1313.lastPlayer.toString(), playerAccountTwentySeven.publicKey.toString());
        assert.equal(q1413.lastPlayer.toString(), playerAccountTwentyEight.publicKey.toString());
        assert.equal(q1513.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1613.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1313.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1413.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1513.numPlayersInQueue.toNumber(), 0);
        assert.equal(q1613.numPlayersInQueue.toNumber(), 0);

        const { updatedGame: g14 } = await finishFourPlayerKingOfHillQueue(program, provider, playerAccountTwentySeven, playerAccountTwentyEight, playerAccountTwentySeven,  gameQueueAccountThirteen, gameQueueAccountFourteen, gameQueueAccountFifteen, gameQueueAccountSixteen, gameAccount);

        // Assert queues were torn down correctly
        assert.equal(g14.gameQueues[0].toString(), gameAccount.publicKey.toString());
        assert.equal(g14.gameQueues[1].toString(), gameAccount.publicKey.toString());
        assert.equal(g14.gameQueues[2].toString(), gameAccount.publicKey.toString());
        assert.equal(g14.gameQueues[3].toString(), gameAccount.publicKey.toString());

        const { playerAccount: playerAccountTwentyNine, gameQueueAccountOne: gameQueueAccountSeventeen, gameQueueAccountTwo: gameQueueAccountEighteen, gameQueueAccountThree: gameQueueAccountNineteen, gameQueueAccountFour: gameQueueAccountTwenty } = await initFourPlayerQueue(program, provider, gameAccount);
        const { playerAccount: playerAccountThirty } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountEighteen, playerAccountTwentyNine);
        const { playerAccount: playerAccountThirtyOne } = await joinKingOfHillQueue(program, provider, gameAccount, gameQueueAccountNineteen, playerAccountTwentyNine);

        const g15 = await program.account.game.fetch(gameAccount.publicKey);
        const p2915 = await program.account.player.fetch(playerAccountTwentyNine.publicKey);
        const p3015 = await program.account.player.fetch(playerAccountThirty.publicKey);
        const p3115 = await program.account.player.fetch(playerAccountThirtyOne.publicKey);
        const q1715 = await program.account.gameQueue.fetch(gameQueueAccountSeventeen.publicKey);
        const q1815 = await program.account.gameQueue.fetch(gameQueueAccountEighteen.publicKey);
        const q1915 = await program.account.gameQueue.fetch(gameQueueAccountNineteen.publicKey);
        const q2015 = await program.account.gameQueue.fetch(gameQueueAccountTwenty.publicKey);

        // Assert queues were set up correctly
        assert.equal(g15.gameQueues[0].toString(), gameQueueAccountSeventeen.publicKey.toString());
        assert.equal(g15.gameQueues[1].toString(), gameQueueAccountEighteen.publicKey.toString());
        assert.equal(g15.gameQueues[2].toString(), gameQueueAccountNineteen.publicKey.toString());
        assert.equal(g15.gameQueues[3].toString(), gameQueueAccountTwenty.publicKey.toString());
        assert.equal(p2915.nextPlayer, null);
        assert.equal(p3015.nextPlayer, null);
        assert.equal(p3115.nextPlayer, null);
        assert.equal(q1715.currentPlayer.toString(), playerAccountTwentyNine.publicKey.toString());
        assert.equal(q1815.currentPlayer.toString(), playerAccountThirty.publicKey.toString());
        assert.equal(q1915.currentPlayer.toString(), playerAccountThirtyOne.publicKey.toString());
        assert.equal(q2015.currentPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1715.lastPlayer.toString(), playerAccountTwentyNine.publicKey.toString());
        assert.equal(q1815.lastPlayer.toString(), playerAccountThirty.publicKey.toString());
        assert.equal(q1915.lastPlayer.toString(), playerAccountThirtyOne.publicKey.toString());
        assert.equal(q2015.lastPlayer.toString(), gameAccount.publicKey.toString());
        assert.equal(q1715.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1815.numPlayersInQueue.toNumber(), 1);
        assert.equal(q1915.numPlayersInQueue.toNumber(), 1);
        assert.equal(q2015.numPlayersInQueue.toNumber(), 0);

        const { updatedGame: g16 } = await finishFourPlayerKingOfHillQueue(program, provider, playerAccountTwentyNine, playerAccountThirty, playerAccountThirtyOne, gameQueueAccountSeventeen, gameQueueAccountEighteen, gameQueueAccountNineteen, gameQueueAccountTwenty, gameAccount);

        // Assert queues were torn down correctly
        assert.equal(g16.gameQueues[0].toString(), gameAccount.publicKey.toString());
        assert.equal(g16.gameQueues[1].toString(), gameAccount.publicKey.toString());
        assert.equal(g16.gameQueues[2].toString(), gameAccount.publicKey.toString());
        assert.equal(g16.gameQueues[3].toString(), gameAccount.publicKey.toString());
  });
});
