import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SplAssociatedTokenInstructionCoder } from "@project-serum/anchor/dist/cjs/coder/spl-associated-token/instruction";
import { assert } from "chai";
import { Arcade } from "../target/types/arcade";

const { makeArcade } = require("./functions/makeArcade.js");
const { makeGame } = require("./functions/makeGame.js");
const { deleteRecentGame } = require("./functions/deleteRecentGame.js");
const { deleteGame } = require("./functions/deleteGame.js");
const { updateLeaderboard } = require("./functions/updateLeaderboard.js");
const { initOnePlayerQueue, initTwoPlayerQueue, initThreePlayerQueue, initFourPlayerQueue } = require("./functions/initQueue.js");
const { joinOnePlayerQueue, joinTwoPlayerQueue, joinThreePlayerQueue, joinFourPlayerQueue } = require("./functions/joinQueue.js");
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

  it("Initializes a game queue for a one player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameter for a 1 player normal game
    const numPlayers = 1;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { player, playerAccount, gameQueue, gameQueueAccount, updatedGame } = await initOnePlayerQueue(program, provider, gameAccount);

    assert.equal(player.nextPlayer, null);
    assert.equal(player.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueue.game.toString(), gameAccount.publicKey.toString());
    assert.equal(gameQueue.currentPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueue.lastPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(gameQueue.numPlayersInQueue, 1);
    assert.equal(updatedGame.gameQueues[0].toString(), gameQueueAccount.publicKey.toString());
  });

  it("Initializes a game queue for a normal two player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 2 player game
    const numPlayers = 2;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, updatedGame } = await initTwoPlayerQueue(program, provider, gameAccount);

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
    assert.equal(updatedGame.gameQueues[0].toString(), gameQueueAccountOne.publicKey.toString());
    assert.equal(updatedGame.gameQueues[1].toString(), gameQueueAccountTwo.publicKey.toString());
  });

  it("Initializes a game queue for a normal three player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 3 player game
    const numPlayers = 3;
    const gameType = 0;

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

  it("Initializes a game queue for a normal four player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 4 player game
    const numPlayers = 4;
    const gameType = 0;

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

  it("Initializes a game queue for a king of the hill two player game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 2 player game
    const numPlayers = 2;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { player, playerAccount, gameQueueOne, gameQueueAccountOne, gameQueueTwo, gameQueueAccountTwo, updatedGame } = await initTwoPlayerQueue(program, provider, gameAccount);

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
    assert.equal(updatedGame.gameQueues[0].toString(), gameQueueAccountOne.publicKey.toString());
    assert.equal(updatedGame.gameQueues[1].toString(), gameQueueAccountTwo.publicKey.toString());
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

  it("allows a second person to join a normal two player game queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 2 player game
    const numPlayers = 2;
    const gameType = 0;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo } = await initTwoPlayerQueue(program, provider, gameAccount);

    const { player: playerTwo, playerAccount: playerAccountTwo } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountOne, playerAccountOne);

    // Get player one
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);

    // Get game queues
    const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);

    assert.equal(playerOne.nextPlayer, null);
    assert.equal(playerTwo.nextPlayer, null);
    assert.equal(playerTwo.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueTwo.numPlayersInQueue.toNumber(), 1);
  });

  it("allows many people to join a normal two player game queue", async () => {
    // 5 6
    // 3 4
    // 1 2

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
    const { player: playerSix, playerAccount: playerAccountSix } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountFive, playerAccountFour);

    // Get players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);
    const playerThree = await program.account.player.fetch(playerAccountThree.publicKey);
    const playerFour = await program.account.player.fetch(playerAccountFour.publicKey);
    const playerFive = await program.account.player.fetch(playerAccountFive.publicKey);

    // Get game queues
    const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);

    assert.equal(playerOne.nextPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(playerTwo.nextPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(playerThree.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(playerFour.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(playerFive.nextPlayer, null);
    assert.equal(playerSix.nextPlayer, null);
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue.toNumber(), 3);
    assert.equal(gameQueueTwo.numPlayersInQueue.toNumber(), 3);
  });

  it("allows for the filling of the first level of the game queue for a normal three player game", async () => {
    // 1 2 3

    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 3 player game
    const numPlayers = 3;
    const gameType = 0;

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

  it("allows for many people to join a normal three player game queue", async( ) => {
    // 7 8 9
    // 4 5 6
    // 1 2 3

    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 3 player game
    const numPlayers = 3;
    const gameType = 0;

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

  it("allows for the filling of the first level of the game queue for a normal four player game", async () => {
    // 1 2 3 4

    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 3 player game
    const numPlayers = 4;
    const gameType = 0;

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

  it("allows for many people to join a normal four person player game queue", async () => {
    // 9 10 11 12
    // 5  6  7  8
    // 1  2  3  4

    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a normal 3 player game
    const numPlayers = 4;
    const gameType = 0;

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

  it("allows a second person to join a king of the hill two player game queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 2 player game
    const numPlayers = 2;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo } = await initTwoPlayerQueue(program, provider, gameAccount);

    const { player: playerTwo, playerAccount: playerAccountTwo } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountOne, playerAccountOne);

    // Get player one
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);

    // Get game queues
    const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);

    assert.equal(playerOne.nextPlayer, null);
    assert.equal(playerTwo.nextPlayer, null);
    assert.equal(playerTwo.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue.toNumber(), 1);
    assert.equal(gameQueueTwo.numPlayersInQueue.toNumber(), 1);
  });

  it("allows many people to join a king of the hill two player game queue", async () => {
    // 5 6
    // 3 4
    // 1 2

    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create global parameters for a king of the hill 2 player game
    const numPlayers = 2;
    const gameType = 1;

    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount, numPlayers, gameType);

    const { playerAccount: playerAccountOne, gameQueueAccountOne, gameQueueAccountTwo } = await initTwoPlayerQueue(program, provider, gameAccount);

    // Create player accounts and add them to the queues
    const { playerAccount: playerAccountTwo } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountOne, playerAccountOne);
    const { playerAccount: playerAccountThree } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountOne, playerAccountTwo);
    const { playerAccount: playerAccountFour } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountThree, playerAccountTwo);

    // Check these player accounts
    const { playerAccount: playerAccountFive } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountThree, playerAccountFour);
    const { player: playerSix, playerAccount: playerAccountSix } = await joinTwoPlayerQueue(program, provider, gameAccount, gameQueueAccountOne, gameQueueAccountTwo, playerAccountFive, playerAccountFour);

    // Get players
    const playerOne = await program.account.player.fetch(playerAccountOne.publicKey);
    const playerTwo = await program.account.player.fetch(playerAccountTwo.publicKey);
    const playerThree = await program.account.player.fetch(playerAccountThree.publicKey);
    const playerFour = await program.account.player.fetch(playerAccountFour.publicKey);
    const playerFive = await program.account.player.fetch(playerAccountFive.publicKey);

    // Get game queues
    const gameQueueOne = await program.account.gameQueue.fetch(gameQueueAccountOne.publicKey);
    const gameQueueTwo = await program.account.gameQueue.fetch(gameQueueAccountTwo.publicKey);

    assert.equal(playerOne.nextPlayer.toString(), playerAccountThree.publicKey.toString());
    assert.equal(playerTwo.nextPlayer.toString(), playerAccountFour.publicKey.toString());
    assert.equal(playerThree.nextPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(playerFour.nextPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(playerFive.nextPlayer, null);
    assert.equal(playerSix.nextPlayer, null);
    assert.equal(gameQueueOne.currentPlayer.toString(), playerAccountOne.publicKey.toString());
    assert.equal(gameQueueTwo.currentPlayer.toString(), playerAccountTwo.publicKey.toString());
    assert.equal(gameQueueOne.lastPlayer.toString(), playerAccountFive.publicKey.toString());
    assert.equal(gameQueueTwo.lastPlayer.toString(), playerAccountSix.publicKey.toString());
    assert.equal(gameQueueOne.numPlayersInQueue.toNumber(), 3);
    assert.equal(gameQueueTwo.numPlayersInQueue.toNumber(), 3);
  });

  it("allows for the filling of the first level of the game queue for a king of the hill three player game", async () => {
    // 1 2 3

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

  it("allows for many people to join a king of the hill three player game queue", async( ) => {
    // 7 8 9
    // 4 5 6
    // 1 2 3

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

  it("allows for the filling of the first level of the game queue for a king of the hill four player game", async () => {
    // 1 2 3 4

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

  it("allows for many people to join a king of the hill four person player game queue", async () => {
    // 9 10 11 12
    // 5  6  7  8
    // 1  2  3  4

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

  it("allows for the filling of the first level of the team game queue for a king of the hill four player game", async () => {
    // 1 2 3 4

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

  it("allows for many people to join a team king of the hill four person player game queue", async () => {
    // 9 10 11 12
    // 5  6  7  8
    // 1  2  3  4

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
});
