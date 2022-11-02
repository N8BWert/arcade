import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { assert } from "chai";
import { Arcade } from "../target/types/arcade";

const { makeArcade } = require("./functions/makeArcade.js");
const { makeGame } = require("./functions/makeGame.js");
const { deleteRecentGame } = require("./functions/deleteRecentGame.js");
const { deleteGame } = require("./functions/deleteGame.js");
const { updateLeaderboard } = require("./functions/updateLeaderboard.js");
const { makeGameQueue } = require("./functions/makeGameQueue.js");
const { playGameEmptyQueue } = require("./functions/playGameEmptyQueue.js");
const { playGame } = require("./functions/playGame.js");

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

    const { game, gameAccount, title, webGLHash, gameArtHash, gameWallet } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

    const updatedArcade = await program.account.arcadeState.fetch(arcadeAccount.publicKey);

    assert.equal(game.title, title);
    assert.equal(game.webGlHash, webGLHash);
    assert.equal(game.gameArtHash, gameArtHash);
    assert.equal(game.earlierGameKey.toString(), gameAccount.publicKey.toString());
    assert.equal(game.laterGameKey.toString(), genesisGameAccount.publicKey.toString());
    assert.equal(game.ownerWallet.toString(), provider.wallet.publicKey.toString());
    assert.equal(game.gameWallet.toString(), gameWallet.publicKey.toString());
    assert.equal(updatedArcade.mostRecentGameKey.toString(), gameAccount.publicKey.toString());
  });

  it("Creates Games in a Linked List", async () => {
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    const { gameAccount: gameAccount1 } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

    const { game: game2, gameAccount: gameAccount2 } = await makeGame(program, provider, arcadeAccount, gameAccount1);

    assert.equal(game2.laterGameKey.toString(), gameAccount1.publicKey.toString());

    const updatedGame1 = await program.account.game.fetch(gameAccount1.publicKey);
    assert.equal(updatedGame1.earlierGameKey.toString(), gameAccount2.publicKey.toString());

    const updatedArcade = await program.account.arcadeState.fetch(arcadeAccount.publicKey);
    assert.equal(updatedArcade.mostRecentGameKey.toString(), gameAccount2.publicKey.toString());
  });

  it("Deletes the Most Recent Game in the Arcade", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create 3 games for the arcade
    const { gameAccount: gameAccount1 } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);
    const { gameAccount: gameAccount2 } = await makeGame(program, provider, arcadeAccount, gameAccount1);
    const { gameAccount: gameAccount3 } = await makeGame(program, provider, arcadeAccount, gameAccount2);

    const { updatedArcade, updatedLaterGame: updatedGame2 } = await deleteRecentGame(program, provider, gameAccount3, arcadeAccount, gameAccount2);

    assert.equal(updatedArcade.mostRecentGameKey.toString(), gameAccount2.publicKey.toString());
    assert.equal(updatedGame2.earlierGameKey.toString(), gameAccount2.publicKey.toString());
  });

  // Deleting the most recent game in the arcade without permission should have a test, but it currently works well

  it("Deletes a Specified Game in the Arcade", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create 3 games for the arcade
    const { gameAccount: gameAccount1 } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);
    const { gameAccount: gameAccount2 } = await makeGame(program, provider, arcadeAccount, gameAccount1);
    const { gameAccount: gameAccount3 } = await makeGame(program, provider, arcadeAccount, gameAccount2);

    const { updatedEarlierGame, updatedLaterGame } = await deleteGame(program, provider, gameAccount2, gameAccount3, gameAccount1);

    assert.equal(updatedEarlierGame.laterGameKey.toString(), gameAccount1.publicKey.toString());
    assert.equal(updatedLaterGame.earlierGameKey.toString(), gameAccount3.publicKey.toString());
  });

  it("Updates first place in game leaderboard", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);
    
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

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

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

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

    // Create third place player
    const playerName = "ABC";
    const score = new anchor.BN(30);
    const walletKey = anchor.web3.Keypair.generate();

    const { updatedGame } = await updateLeaderboard(program, provider, gameAccount, playerName, score, walletKey);

    assert.equal(updatedGame.leaderboard.thirdPlace.name, playerName);
    assert.equal(updatedGame.leaderboard.thirdPlace.walletKey.toString(), walletKey.publicKey.toString());
    assert.equal(updatedGame.leaderboard.thirdPlace.score.toNumber(), score.toNumber());
  });

  it("Creates a Game Queue for a game", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

    // Create the game queue
    const { queueAccount, gameQueue } = await makeGameQueue(program, provider, gameAccount);

    const updatedGame = await program.account.game.fetch(gameAccount.publicKey);

    assert.equal(gameQueue.game.toString(), gameAccount.publicKey.toString());
    assert.equal(updatedGame.gameQueue.toString(), queueAccount.publicKey.toString());
  });

  it("allows joining the game queue for empty game queues", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

    // Create the game queue
    const { queueAccount } = await makeGameQueue(program, provider, gameAccount);

    // Create the initial game queue player
    const { playerAccount, player } = await playGameEmptyQueue(program, provider, gameAccount, queueAccount);

    const updatedQueue = await program.account.gameQueue.fetch(queueAccount.publicKey);

    assert.equal(updatedQueue.nextPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(updatedQueue.lastPlayer.toString(), playerAccount.publicKey.toString());
    assert.equal(player.walletKey.toString(), provider.wallet.publicKey.toString());
  });

  it("allows joining the game queue for a non-empty game queue", async () => {
    // Create an arcade
    const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

    // Create 1 game for the arcade
    const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

    // Create the game queue
    const { queueAccount } = await makeGameQueue(program, provider, gameAccount);

    // Create the initial game queue player
    const { playerAccount: initialPlayerAccount } = await playGameEmptyQueue(program, provider, gameAccount, queueAccount);

    // Create another player to join the now non-empty game queue
    const { playerAccount: newPlayerAccount, player } = await playGame(program, provider, gameAccount, queueAccount, initialPlayerAccount);

    const updatedQueue = await program.account.gameQueue.fetch(queueAccount.publicKey);
    const updatedInitialPlayer = await program.account.player.fetch(initialPlayerAccount.publicKey);

    assert.equal(updatedQueue.nextPlayer.toString(), initialPlayerAccount.publicKey.toString());
    assert.equal(updatedQueue.lastPlayer.toString(), newPlayerAccount.publicKey.toString());
    assert.equal(player.walletKey.toString(), provider.wallet.publicKey.toString());
    assert.equal(updatedInitialPlayer.nextPlayer.toString(), newPlayerAccount.publicKey.toString());
  });
});
