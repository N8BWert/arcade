import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { assert } from "chai";
import { Arcade } from "../target/types/arcade";

const { makeArcade } = require("./functions/makeArcade.js");
const { makeGame } = require("./functions/makeGame.js");
const { deleteRecentGame } = require("./functions/deleteRecentGame.js");
const { deleteGame } = require("./functions/deleteGame.js");
const { updateLeaderboard } = require("./functions/updateLeaderboard.js");

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

  // TODO: FIX THE BELOW TEST
  // it("Deletes a Specified Game in the Arcade", async () => {
  //   // Create an arcade
  //   const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

  //   // Create 3 games for the arcade
  //   const { gameAccount: gameAccount1 } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);
  //   const { gameAccount: gameAccount2 } = await makeGame(program, provider, arcadeAccount, gameAccount1);
  //   const { gameAccount: gameAccount3 } = await makeGame(program, provider, arcadeAccount, gameAccount2);

  //   const { updatedEarlierGame: updatedGameAccount1, updatedLaterGame: updatedGameAccount3 } = await deleteGame(program, provider, gameAccount2, gameAccount3, gameAccount1);

  //   assert.equal(updatedGameAccount1.earlierGameKey.toString(), gameAccount3.publicKey.toString());

  //   assert.equal(updatedGameAccount3.laterGameKey.toString(), gameAccount1.publicKey.toString());
  // });

  // TODO: FIX THE BELOW TEST
  // it("Updates the game leaderboard", async () => {
  //   // Create an arcade
  //   const { arcadeAccount, genesisGameAccount } = await makeArcade(program, provider);

  //   // Create a game for the arcade
  //   const { gameAccount } = await makeGame(program, provider, arcadeAccount, genesisGameAccount);

  //   const { playerName, score, walletKey, updatedGame } = await updateLeaderboard(program, provider, gameAccount);

  //   console.log(updatedGame);

  //   assert.equal(updatedGame.leaderboard.firstPlace.name, playerName);
  //   assert.equal(updatedGame.leaderboard.firstPlace.wallet_key.toString(), walletKey.publicKey.toString());
  //   assert.equal(updatedGame.leaderboard.firstPlace.score, score);
  // });
});
