import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { assert } from "chai";
import { Arcade } from "../target/types/arcade";

const { makeArcade } = require("./functions/makeArcade.js");
const { makeGame } = require("./functions/makeGame.js");
const { deleteRecentGame } = require("./functions/deleteRecentGame.js");
const { deleteGame } = require("./functions/deleteGame.js");
const { updateLeaderboard } = require("./functions/updateLeaderboard.js");
const { playGame } = require("./functions/playGame.js");
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
});
