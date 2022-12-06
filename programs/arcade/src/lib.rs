use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;

use std::mem;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// AS OF October 13th 2022 at 3:20 PM the price of solana is $32.06
// That means that currently $0.25 is 0.00779788 SOL

const TWENTY_FIVE_CENTS: u64 = (0.0779766 * (LAMPORTS_PER_SOL as f32)) as u64;

#[program]
pub mod arcade {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// This function initializes the arcade (i.e. creates the arcade the games will exist on)
    /// 
    /// Currently, I think there will only be one arcade, however it may be useful later to have the ability to have multiple arcades
    /// so this will exist for those possibilities.
    pub fn initialize_arcade(ctx: Context<InitArcade>) -> ProgramResult {
        // Get accounts from the context.
        let arcade_account = &mut ctx.accounts.arcade_account;
        let genesis_game_account = &mut ctx.accounts.genesis_game_account;
        let authority = &mut ctx.accounts.authority;

        // Set up the arcade state.
        arcade_account.authority = authority.key();
        arcade_account.most_recent_game_key = genesis_game_account.key();
        arcade_account.most_recent_game_pot_key = None;

        // If everything went well return Ok.
        Ok(())
    }

    /// This function should handel the creation of a new game/arcade machine.
    /// 
    /// Currently, I think that as games are added they will be added to the front part of the queue
    /// so users will see the newest games.  I don't really want a popularity contest so I'm thinking
    /// this is the best way to do this.
    /// 
    /// NOTE: I need to create a webgl build extension/add-on that creates a game wallet for games that 
    /// are to be added to the arcade.  Then I need to pass that wallet address into here to ensure the games
    /// get their money.
    pub fn create_game(
        ctx: Context<MakeGame>,
        title: String,
        web_gl_hash: String,
        game_art_hash: String,
        num_players: u8,
        game_type: u8,
    ) -> ProgramResult {
        // Get accounts from the context
        let game_account = &mut ctx.accounts.game_account;
        let most_recent_game_account = &mut ctx.accounts.most_recent_game_account;
        let arcade_account = &mut ctx.accounts.arcade_account;
        let owner = &mut ctx.accounts.owner;

        // Initialize game_account
        game_account.title = title;
        game_account.web_gl_hash = web_gl_hash;
        game_account.game_art_hash = game_art_hash;

        // TODO: figure out how to link this game_wallet and the web gl account wallet.
        game_account.owner_wallet = owner.key();
        game_account.older_game_key = arcade_account.most_recent_game_key;
        game_account.younger_game_key = game_account.key();
        game_account.max_players = num_players;
        game_account.game_type = game_type;

        // Initialize leaderboard
        let first_place = Place {name: String::from("AAA"), wallet_key: owner.key(), score: 100};
        let second_place = Place {name: String::from("BBB"), wallet_key: owner.key(), score: 50};
        let third_place = Place {name: String::from("CCC"), wallet_key: owner.key(), score: 25};

        let leaderboard = Leaderboard {first_place, second_place, third_place};

        game_account.leaderboard = leaderboard;

        // Store most recent game key as current game key in arcade account.
        arcade_account.most_recent_game_key = game_account.key();

        // TODO: connect past most_recent_game_key to the new game
        most_recent_game_account.younger_game_key = game_account.key();

        // Emit the game created event.
        emit!(GameEvent {
            label: "CREATE".to_string(),
            game_id: game_account.key(),
            more_recent_game_id: None,
            less_recent_game_id: Some(game_account.older_game_key),
        });

        Ok(())
    }

    /// This function deletes a game, while making sure that the person deleting the machine/game is
    /// the person who owns it.  I would like anyone to upload whatever they want onto the arcade which
    /// may come back to bite me, but I think this is the best way to promote an open space.
    pub fn delete_game(ctx: Context<DeleteGame>) -> Result<()> {
        let game_account = &mut ctx.accounts.game_account;
        let younger_game = &mut ctx.accounts.younger_game;
        let older_game = &mut ctx.accounts.older_game;

        younger_game.older_game_key = older_game.key();
        older_game.younger_game_key = younger_game.key();

        emit!(GameEvent {
            label: "DELETE".to_string(),
            game_id: game_account.key(),
            more_recent_game_id: Some(younger_game.key()),
            less_recent_game_id: Some(older_game.key()),
        });

        Ok(())
    }

    /// This game deletes the most recent game.
    /// 
    /// I'm going to be completely honest, I think I'm going to delete this and instead make the arcade a 
    /// circular linked list, but this is here for now.
    pub fn delete_most_recent_game(ctx: Context<DeleteMostRecentGame>) -> Result<()> {
        let game_account = &mut ctx.accounts.game_account;
        let older_game = &mut ctx.accounts.older_game;
        let arcade_state = &mut ctx.accounts.arcade_state;

        older_game.younger_game_key = older_game.key();

        arcade_state.most_recent_game_key = older_game.key();

        emit!(GameEvent {
            label: "DELETE".to_string(),
            game_id: game_account.key(),
            more_recent_game_id: None,
            less_recent_game_id: Some(older_game.key()),
        });

        Ok(())
    }

    /// This function initializes the game queues of a one player normal game
    /// 
    /// This function will require the user to pay for the created accounts as well as an additional $0.25
    /// to fund the game account.
    pub fn init_one_player_game_queue(ctx: Context<InitOnePlayerGameQueue>) -> ProgramResult {
        let game_queue_account = &mut ctx.accounts.game_queue_account;
        let player_account = &mut ctx.accounts.player_account;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        game_queue_account.game = game_account.key();
        game_queue_account.current_player = player_account.key();
        game_queue_account.last_player = player_account.key();
        game_queue_account.num_players_in_queue = 1;

        if game_account.game_queues.len() == 0 {
            game_account.game_queues.push(game_queue_account.key());
        } else {
            game_account.game_queues[0] = game_queue_account.key();
        }

        // emit an event to make known that a queue is being created
        emit!(NewQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![game_queue_account.key()],
            queue_nums: vec![1],
            new_player_ids: vec![Some(player_account.key())],
            num_players: vec![1],
        });

        Ok(())
    }

    /// This function allows a user to join the queue of a 1 player game
    pub fn join_one_player_game_queue(ctx: Context<JoinOnePlayerGameQueue>) -> ProgramResult {
        let player_account = &mut ctx.accounts.player_account;
        let last_player = &mut ctx.accounts.last_player;
        let game_queue_account = &mut ctx.accounts.game_queue_account;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        last_player.next_player = Some(player_account.key());

        game_queue_account.last_player = player_account.key();
        game_queue_account.num_players_in_queue += 1;

        // Emit an event to make known the queue has been updated
        emit!(JoinQueueEvent {
            game_id: game_account.key(),
            queue_id: game_queue_account.key(),
            queue_num: 1,
            last_player: player_account.key(),
            num_players: game_queue_account.num_players_in_queue,
        });

        Ok(())
    }

    /// This function advances a one player game (i.e. makes the next player the current player etc.)
    pub fn advance_one_player_game_queue(ctx: Context<AdvanceOnePlayerGameQueue>) -> Result<()> {
        let game_account = & ctx.accounts.game_account;
        let current_player = &mut ctx.accounts.current_player;
        let game_queue_account = &mut ctx.accounts.game_queue_account;

        (game_queue_account.current_player, game_queue_account.num_players_in_queue) = match current_player.next_player {
            Some(player) => (player, game_queue_account.num_players_in_queue - 1),
            None => return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into()),
        };

        // emit an event to make known that the queue has been advanced
        emit!(AdvanceQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![game_queue_account.key()],
            queue_nums: vec![1],
            finished_players: vec![Some(current_player.key())],
            new_players: vec![current_player.next_player],
            num_players: vec![game_queue_account.num_players_in_queue],
        });

        Ok(())
    }
    
    /// This function destroys the queues associated with the one player game to save space and resources.
    /// 
    /// The credits associated with these queues is then credited to the game account.
    pub fn finish_one_player_game_queue(ctx: Context<FinishOnePlayerGameQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        game_account.game_queues[0] = game_account.key();

        emit!(FinishQueueEvent {
            game_id: game_account.key()
        });

        Ok(())
    }

    /// This function initializes the game queues for a two player game.
    /// 
    /// The person initializing the queues will pay $0.25 + the amount it costs to create the queues.
    pub fn init_two_player_game_queue(ctx: Context<InitTwoPlayerGameQueue>) -> ProgramResult {
        let player_account = &mut ctx.accounts.player_account;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;
        
        game_queue_account_one.game = game_account.key();
        game_queue_account_one.current_player = player_account.key();
        game_queue_account_one.last_player = player_account.key();
        game_queue_account_one.num_players_in_queue = 1;

        game_queue_account_two.game = game_account.key();
        game_queue_account_two.current_player = game_account.key();
        game_queue_account_two.last_player = game_account.key();
        game_queue_account_two.num_players_in_queue = 0;

        if game_account.game_queues.len() == 0 {
            game_account.game_queues.push(game_queue_account_one.key());
            game_account.game_queues.push(game_queue_account_two.key());
        } else {
            game_account.game_queues[0] = game_queue_account_one.key();
            game_account.game_queues[1] = game_queue_account_two.key();
        }

        // emit an event to make known that a new queue has been created
        emit!(NewQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![game_queue_account_one.key(), game_queue_account_two.key()],
            queue_nums: vec![1, 2],
            new_player_ids: vec![Some(player_account.key()), None],
            num_players: vec![1, 0],
        });

        Ok(())
    }

    /// This function allows a user to join a two player game queue
    pub fn join_two_player_game_queue(ctx: Context<JoinTwoPlayerGameQueue>) -> Result<()> {
        let player_account = &mut ctx.accounts.player_account;
        let q1_last_player = &mut ctx.accounts.q1_last_player;
        let q2_last_player = &mut ctx.accounts.q2_last_player;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        if game_queue_account_two.current_player != game_account.key() &&
           game_queue_account_two.last_player != q2_last_player.key() {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        }

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        if q1_last_player.key() == q2_last_player.key() {
            // Add new player as player 2
            game_queue_account_two.current_player = player_account.key();
            game_queue_account_two.last_player = player_account.key();
            game_queue_account_two.num_players_in_queue = 1;

            // emit an event to make known a player has joined the queue
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_two.key(),
                queue_num: 2,
                last_player: player_account.key(),
                num_players: 1,
            });
        } else if game_queue_account_one.num_players_in_queue == game_queue_account_two.num_players_in_queue {
            // Add new player behind current player 1
            q1_last_player.next_player = Some(player_account.key());
            game_queue_account_one.last_player = player_account.key();
            game_queue_account_one.num_players_in_queue += 1;

            // emit an event to make known a player has joined the queue
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_one.key(),
                queue_num: 1,
                last_player: player_account.key(),
                num_players: game_queue_account_one.num_players_in_queue,
            });
        } else {
            // Add new player behind current player 2
            q2_last_player.next_player = Some(player_account.key());
            game_queue_account_two.last_player = player_account.key();
            game_queue_account_two.num_players_in_queue += 1;

            // emit an event to make known a player has joined the queue
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_two.key(),
                queue_num: 2,
                last_player: player_account.key(),
                num_players: game_queue_account_two.num_players_in_queue,
            });
        }

        Ok(())
    }

    /// Advances a 2 player game queue.
    /// 
    /// E F -> 
    /// C D -> E F -> 
    /// A B -> C D -> E F
    pub fn advance_two_player_game_queue(ctx: Context<AdvanceTwoPlayerGameQueue>) -> Result<()> {
        let player_one = &mut ctx.accounts.player_one;
        let player_two = &mut ctx.accounts.player_two;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_account = & ctx.accounts.game_account;

        (game_queue_account_one.current_player, game_queue_account_one.last_player, game_queue_account_one.num_players_in_queue) = match player_one.next_player {
            Some(player) => (player, game_queue_account_one.last_player, game_queue_account_one.num_players_in_queue - 1),
            None => return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into()),
        };

        (game_queue_account_two.current_player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue) = match player_two.next_player {
            Some(player) => (player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue - 1),
            None => (game_account.key(), game_account.key(), 0),
        };

        emit!(AdvanceQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![game_queue_account_one.key(), game_queue_account_two.key()],
            queue_nums: vec![1, 2],
            finished_players: if player_one.key() == player_two.key() { vec![Some(player_one.key()), None] }
                              else { vec![Some(player_one.key()), Some(player_two.key())] },
            new_players: if game_queue_account_two.current_player == game_account.key() { vec![Some(game_queue_account_one.current_player), None] }
                         else { vec![Some(game_queue_account_one.current_player), Some(game_queue_account_two.current_player)] },
            num_players: vec![game_queue_account_one.num_players_in_queue, game_queue_account_two.num_players_in_queue],
        });

        Ok(())
    }

    /// Advances a two player king of the hill game queue
    /// 
    /// E F -> E   -> E   ->     ->     -> 
    /// C D -> C F -> C   ->   E ->     -> 
    /// A B -> A D -> A F -> A C -> A E -> A
    pub fn advance_two_player_king_of_hill_queue(ctx: Context<AdvanceTwoPlayerKingOfHillQueue>) -> Result<()> {
        let game_account = &mut ctx.accounts.game_account;
        let winning_player = &mut ctx.accounts.winning_player;
        let losing_player = &mut ctx.accounts.losing_player;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;

        if winning_player.key() != game_queue_account_one.current_player && winning_player.key() != game_queue_account_two.current_player {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        } else if losing_player.key() != game_queue_account_one.current_player && losing_player.key() != game_queue_account_two.current_player {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        }

        if losing_player.key() == game_queue_account_one.current_player {
            (game_queue_account_one.current_player, game_queue_account_one.last_player, game_queue_account_one.num_players_in_queue) = match losing_player.next_player {
                Some(player) => (player, game_queue_account_one.last_player, game_queue_account_one.num_players_in_queue - 1),
                None => match winning_player.next_player {
                    Some(player) => {
                        let last_player_two = game_queue_account_two.last_player;
                        let old_queue_two_num_players = game_queue_account_two.num_players_in_queue - 1;
                        game_queue_account_two.last_player = winning_player.key();
                        game_queue_account_two.num_players_in_queue = 1;
                        winning_player.next_player = None;

                        (player, last_player_two, old_queue_two_num_players)
                    },
                    None => (game_account.key(), game_account.key(), 0),
                },
            };

            // emit an event to make known that the queues have been advanced
            emit!(AdvanceQueueEvent {
                game_id: game_account.key(),
                queue_ids: vec![game_queue_account_one.key()],
                queue_nums: vec![1],
                finished_players: vec![Some(losing_player.key())],
                new_players: vec![losing_player.next_player],
                num_players: vec![game_queue_account_one.num_players_in_queue, game_queue_account_two.num_players_in_queue],
            });
        } else {
            (game_queue_account_two.current_player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue) = match losing_player.next_player {
                Some(player) => (player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue - 1),
                None => match winning_player.next_player {
                    Some(player) => {
                        let last_player_one = game_queue_account_one.last_player;
                        let old_queue_one_num_players = game_queue_account_one.num_players_in_queue - 1;
                        game_queue_account_one.last_player = winning_player.key();
                        game_queue_account_one.num_players_in_queue = 1;
                        winning_player.next_player = None;
                        
                        (player, last_player_one, old_queue_one_num_players)
                    },
                    None => (game_account.key(), game_account.key(), 0),
                },
            };

            // emit an event to make known that the queues have been advanced
            emit!(AdvanceQueueEvent {
                game_id: game_account.key(),
                queue_ids: vec![game_queue_account_two.key()],
                queue_nums: vec![2],
                finished_players: vec![Some(losing_player.key())],
                new_players: vec![losing_player.next_player],
                num_players: vec![game_queue_account_one.num_players_in_queue, game_queue_account_two.num_players_in_queue],
            });
        }

        return Ok(());
    }

    /// Finishes a 2 player game by resetting the game queue pointers.
    pub fn finish_two_player_game_queue(ctx: Context<FinishTwoPlayerGameQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        for i in 0..2 {
            game_account.game_queues[i] = game_account.key();
        }

        // emit an event to make known that the queues have been deleted
        emit!(FinishQueueEvent {
            game_id: game_account.key(),
        });

        Ok(())
    }

    /// Finishes a 2 player king of the hill game by resetting the game queue pointers.
    pub fn finish_two_player_king_of_hill_queue(ctx: Context<FinishTwoPlayerKingOfHillQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        for i in 0..2 {
            game_account.game_queues[i] = game_account.key();
        }

        // emit an event to make known that the queues have been deleted
        emit!(FinishQueueEvent {
            game_id: game_account.key(),
        });

        Ok(())
    }

    /// Initializes the game queues of a 3 player game.
    pub fn init_three_player_game_queue(ctx: Context<InitThreePlayerGameQueue>) -> ProgramResult {
        let player_account = &mut ctx.accounts.player_account;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_queue_account_three = &mut ctx.accounts.game_queue_account_three;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        game_queue_account_one.game = game_account.key();
        game_queue_account_one.current_player = player_account.key();
        game_queue_account_one.last_player = player_account.key();
        game_queue_account_one.num_players_in_queue = 1;

        game_queue_account_two.game = game_account.key();
        game_queue_account_two.current_player = game_account.key();
        game_queue_account_two.last_player = game_account.key();
        game_queue_account_two.num_players_in_queue = 0;

        game_queue_account_three.game = game_account.key();
        game_queue_account_three.current_player = game_account.key();
        game_queue_account_three.last_player = game_account.key();
        game_queue_account_three.num_players_in_queue = 0;

        if game_account.game_queues.len() == 0 {
            game_account.game_queues.push(game_queue_account_one.key());
            game_account.game_queues.push(game_queue_account_two.key());
            game_account.game_queues.push(game_queue_account_three.key());
        } else {
            game_account.game_queues[0] = game_queue_account_one.key();
            game_account.game_queues[1] = game_queue_account_two.key();
            game_account.game_queues[2] = game_queue_account_three.key();
        }

        // emit event to make known that a new game queue has started
        emit!(NewQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![
                game_queue_account_one.key(),
                game_queue_account_two.key(),
                game_queue_account_three.key(),
            ],
            queue_nums: vec![1, 2, 3],
            new_player_ids: vec![Some(player_account.key()), None, None],
            num_players: vec![1, 0, 0],
        });

        Ok(())
    }

    /// Joins a player into a normal 3 player game queue
    pub fn join_three_player_game_queue(ctx: Context<JoinThreePlayerGameQueue>) -> Result<()> {
        let player_account = &mut ctx.accounts.player_account;
        let q1_last_player = &mut ctx.accounts.q1_last_player;
        let q2_last_player = &mut ctx.accounts.q2_last_player;
        let q3_last_player = &mut ctx.accounts.q3_last_player;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_queue_account_three = &mut ctx.accounts.game_queue_account_three;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        if game_queue_account_two.current_player != game_account.key() &&
           game_queue_account_two.last_player != q2_last_player.key() {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        } else if game_queue_account_three.current_player != game_account.key() &&
                  game_queue_account_three.last_player != q3_last_player.key() {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        }

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        if game_queue_account_two.current_player == game_account.key() {
            // Add a new player as player 2
            game_queue_account_two.current_player = player_account.key();
            game_queue_account_two.last_player = player_account.key();
            game_queue_account_two.num_players_in_queue = 1;

            // emit event to make known that a player has joined the game
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_two.key(),
                queue_num: 2,
                last_player: player_account.key(),
                num_players: 1,
            });

            return Ok(());
        }

        if game_queue_account_three.current_player == game_account.key() {
            // Add a new player as player 3
            game_queue_account_three.current_player = player_account.key();
            game_queue_account_three.last_player = player_account.key();
            game_queue_account_three.num_players_in_queue = 1;

            // emit an event to make known that a player has joined the game
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_three.key(),
                queue_num: 3,
                last_player: player_account.key(),
                num_players: 1,
            });

            return Ok(());
        }

        if game_queue_account_one.num_players_in_queue == game_queue_account_two.num_players_in_queue &&
           game_queue_account_two.num_players_in_queue == game_queue_account_three.num_players_in_queue {
            // Add a new player behind player 1.
            q1_last_player.next_player = Some(player_account.key());
            game_queue_account_one.last_player = player_account.key();
            game_queue_account_one.num_players_in_queue += 1;

            // emit an event to make known a player has been added to the end of queue 1
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_one.key(),
                queue_num: 1,
                last_player: player_account.key(),
                num_players: game_queue_account_one.num_players_in_queue,
            });
        } else if game_queue_account_two.num_players_in_queue == game_queue_account_three.num_players_in_queue {
            // Add a new player behind player 2.
            q2_last_player.next_player = Some(player_account.key());
            game_queue_account_two.last_player = player_account.key();
            game_queue_account_two.num_players_in_queue += 1;

            // emit an event to make known a player has been added to the end of queue 2
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_two.key(),
                queue_num: 2,
                last_player: player_account.key(),
                num_players: game_queue_account_two.num_players_in_queue,
            });
        } else {
            // Add a new player behind player 3.
            q3_last_player.next_player = Some(player_account.key());
            game_queue_account_three.last_player = player_account.key();
            game_queue_account_three.num_players_in_queue += 1;

            // emit an event to make known a player has been added to the end of queue 3
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_three.key(),
                queue_num: 3,
                last_player: player_account.key(),
                num_players: game_queue_account_three.num_players_in_queue,
            });
        }

        Ok(())
    }

    /// Advances the game queue for a normal 3 player game
    /// 
    /// G H I ->       -> 
    /// D E F -> G H I ->
    /// A B C -> D E F -> G H I
    pub fn advance_three_player_game_queue(ctx: Context<AdvanceThreePlayerGameQueue>) -> Result<()> {
        let player_one = &mut ctx.accounts.player_one;
        let player_two = &mut ctx.accounts.player_two;
        let player_three = &mut ctx.accounts.player_three;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_queue_account_three = &mut ctx.accounts.game_queue_account_three;
        let game_account = & ctx.accounts.game_account;

        (game_queue_account_one.current_player, game_queue_account_two.last_player, game_queue_account_one.num_players_in_queue) = match player_one.next_player {
            Some(player) => (player, game_queue_account_two.last_player, game_queue_account_one.num_players_in_queue - 1),
            None => return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into()),
        };

        (game_queue_account_two.current_player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue) = match player_two.next_player {
            Some(player) => (player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue - 1),
            None => (game_account.key(), game_account.key(), 0),
        };

        (game_queue_account_three.current_player, game_queue_account_three.last_player, game_queue_account_three.num_players_in_queue) = match player_three.next_player {
            Some(player) => (player, game_queue_account_three.last_player, game_queue_account_three.num_players_in_queue - 1),
            None => (game_account.key(), game_account.key(), 0),
        };

        // emit an event to make known that the game queue has been advanced
        emit!(AdvanceQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![
                game_queue_account_one.key(),
                game_queue_account_two.key(),
                game_queue_account_three.key(),
            ],
            queue_nums: vec![1, 2, 3],
            finished_players: vec![
                Some(player_one.key()),
                Some(player_two.key()),
                Some(player_three.key()),
            ],
            new_players: vec![
                player_one.next_player,
                player_two.next_player,
                player_three.next_player,
            ],
            num_players: vec![
                game_queue_account_one.num_players_in_queue,
                game_queue_account_two.num_players_in_queue,
                game_queue_account_three.num_players_in_queue,
            ],
        });

        Ok(())
    }

    /// Advances the game queues for a 3 player king of the hill game.
    /// 
    /// 7 8 9 ->     9  |  5     ->      
    /// 4 5 6 -> 7 8 6  |  4     -> 5    
    /// 1 2 3 -> 4 5 3  |  1 2 3 -> 4 _ 3
    /// x x o           |  x x o
    pub fn advance_three_player_king_of_hill_queue(ctx: Context<AdvanceThreePlayerKingOfHillQueue>) -> Result<()> {
        let winning_player = &mut ctx.accounts.winning_player;
        let losing_player_one = &mut ctx.accounts.losing_player_one;
        let losing_player_two = &mut ctx.accounts.losing_player_two;
        let queues = [&mut ctx.accounts.game_queue_account_one, &mut ctx.accounts.game_queue_account_two, &mut ctx.accounts.game_queue_account_three];
        let game_account = & ctx.accounts.game_account;
        let mut player_mappings = [0, 0, 0];
        let mut winning_queue_num = 0;

        for i in 0..3 {
            if queues[i].current_player == winning_player.key() {
                player_mappings[i] = 1;
                winning_queue_num = i;
            } else if queues[i].current_player == losing_player_one.key() {
                player_mappings[i] = 2;
            } else if queues[i].current_player == losing_player_two.key() {
                player_mappings[i] = 3;
            } else if queues[i].current_player == game_account.key() {
                player_mappings[i] = 5;
            } else {
                return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
            }
        }

        let mut queue_ids = Vec::with_capacity(2);
        let mut queue_nums = Vec::with_capacity(2);
        let mut finished_players = Vec::with_capacity(2);
        let mut new_players = Vec::with_capacity(2);
        let mut num_players = Vec::with_capacity(2);

        for i in 0..3 {
            if player_mappings[i] == 2 {
                (queues[i].current_player, queues[i].last_player, queues[i].num_players_in_queue) = match losing_player_one.next_player {
                    Some(player) => (player, queues[i].last_player, queues[i].num_players_in_queue - 1),
                    None => match winning_player.next_player {
                        Some(player) => {
                            let old_winning_queue_last_player = queues[winning_queue_num].last_player;
                            let old_num_players = queues[winning_queue_num].num_players_in_queue - 1;

                            winning_player.next_player = None;
                            queues[winning_queue_num].last_player = winning_player.key();
                            queues[winning_queue_num].num_players_in_queue = 1;

                            (player, old_winning_queue_last_player, old_num_players)
                        },
                        None => (game_account.key(), game_account.key(), 0),
                    },
                };

                queue_ids.push(queues[i].key());
                queue_nums.push(i as u8);
                finished_players.push(Some(losing_player_one.key()));
                new_players.push(if queues[i].current_player != game_account.key() { Some(queues[i].current_player) } else { None });
                num_players.push(queues[i].num_players_in_queue);
            } else if player_mappings[i] == 3 {
                (queues[i].current_player, queues[i].last_player, queues[i].num_players_in_queue) = match losing_player_two.next_player {
                    Some(player) => (player, queues[i].last_player, queues[i].num_players_in_queue - 1),
                    None => match winning_player.next_player {
                        Some(player) => {
                            let old_winning_queue_last_player = queues[winning_queue_num].last_player;
                            let old_num_players = queues[winning_queue_num].num_players_in_queue - 1;

                            winning_player.next_player = None;
                            queues[winning_queue_num].last_player = winning_player.key();
                            queues[winning_queue_num].num_players_in_queue = 1;

                            (player, old_winning_queue_last_player, old_num_players)
                        },
                        None => {
                            (game_account.key(), game_account.key(), 0)
                        },
                    },
                };

                queue_ids.push(queues[i].key());
                queue_nums.push(i as u8);
                finished_players.push(Some(losing_player_two.key()));
                new_players.push(if queues[i].current_player != game_account.key() { Some(queues[i].current_player) } else { None });
                num_players.push(queues[i].num_players_in_queue);
            }
        }

        // emit an event to make known that the game queue has advanced
        emit!(AdvanceQueueEvent {
            game_id: game_account.key(),
            queue_ids: queue_ids,
            queue_nums: queue_nums,
            finished_players: finished_players,
            new_players: new_players,
            num_players: num_players,
        });

        Ok(())
    }

    /// Finishes the game queues for a 3 player game by resetting their pointers.
    pub fn finish_three_player_game_queue(ctx: Context<FinishThreePlayerGameQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        for i in 0..3 {
            game_account.game_queues[i] = game_account.key();
        }

        // emit an event to make known that the game queue has ended
        emit!(FinishQueueEvent {
            game_id: game_account.key(),
        });

        Ok(())
    }

    /// Finishes the game queues for a 3 player king of the hill game by resetting their pointers.
    pub fn finish_three_player_king_of_hill_queue(ctx: Context<FinishThreePlayerKingOfHillQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        for i in 0..3 {
            game_account.game_queues[i] = game_account.key();
        }

        // emit and event to make known that the game queue has ended
        emit!(FinishQueueEvent {
            game_id: game_account.key(),
        });
    
        Ok(())
    }

    /// Initializes the game queues for a 4 player game.
    pub fn init_four_player_game_queue(ctx: Context<InitFourPlayerGameQueue>) -> ProgramResult {
        let player_account = &mut ctx.accounts.player_account;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_queue_account_three = &mut ctx.accounts.game_queue_account_three;
        let game_queue_account_four = &mut ctx.accounts.game_queue_account_four;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        game_queue_account_one.game = game_account.key();
        game_queue_account_one.current_player = player_account.key();
        game_queue_account_one.last_player = player_account.key();
        game_queue_account_one.num_players_in_queue = 1;

        game_queue_account_two.game = game_account.key();
        game_queue_account_two.current_player = game_account.key();
        game_queue_account_two.last_player = game_account.key();
        game_queue_account_two.num_players_in_queue = 0;

        game_queue_account_three.game = game_account.key();
        game_queue_account_three.current_player = game_account.key();
        game_queue_account_three.last_player = game_account.key();
        game_queue_account_three.num_players_in_queue = 0;

        game_queue_account_four.game = game_account.key();
        game_queue_account_four.current_player = game_account.key();
        game_queue_account_four.last_player = game_account.key();
        game_queue_account_four.num_players_in_queue = 0;

        if game_account.game_queues.len() == 0 {
            game_account.game_queues.push(game_queue_account_one.key());
            game_account.game_queues.push(game_queue_account_two.key());
            game_account.game_queues.push(game_queue_account_three.key());
            game_account.game_queues.push(game_queue_account_four.key());
        } else {
            game_account.game_queues[0] = game_queue_account_one.key();
            game_account.game_queues[1] = game_queue_account_two.key();
            game_account.game_queues[2] = game_queue_account_three.key();
            game_account.game_queues[3] = game_queue_account_four.key();
        }

        // emit an event to make known the queues were initialized
        emit!(NewQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![
                game_queue_account_one.key(),
                game_queue_account_two.key(),
                game_queue_account_three.key(),
                game_queue_account_four.key(),
            ],
            queue_nums: vec![1, 2, 3, 4],
            new_player_ids: vec![
                Some(player_account.key()),
                None,
                None,
                None,
            ],
            num_players: vec![1, 0, 0, 0],
        });
        
        Ok(())
    }

    /// Joins a player in to a game queue for a normal 4 player game.
    /// 
    /// Players are added from left to right to keep order.
    pub fn join_four_player_game_queue(ctx: Context<JoinFourPlayerGameQueue>) -> Result<()> {
        let player_account = &mut ctx.accounts.player_account;
        let q1_last_player = &mut ctx.accounts.q1_last_player;
        let q2_last_player = &mut ctx.accounts.q2_last_player;
        let q3_last_player = &mut ctx.accounts.q3_last_player;
        let q4_last_player = &mut ctx.accounts.q4_last_player;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_queue_account_three = &mut ctx.accounts.game_queue_account_three;
        let game_queue_account_four = &mut ctx.accounts.game_queue_account_four;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        if game_queue_account_two.current_player != game_account.key() &&
           game_queue_account_two.last_player != q2_last_player.key() {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        } else if game_queue_account_three.current_player != game_account.key() &&
                  game_queue_account_three.last_player != q3_last_player.key() {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        } else if game_queue_account_four.current_player != game_account.key() &&
                  game_queue_account_four.last_player != q4_last_player.key() {
            return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
        }

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        if game_queue_account_two.current_player == game_account.key() {
            // Add a new player as player 2
            game_queue_account_two.current_player = player_account.key();
            game_queue_account_two.last_player = player_account.key();
            game_queue_account_two.num_players_in_queue = 1;

            // emit an event to make known a player has joined game queue 2
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_two.key(),
                queue_num: 2,
                last_player: player_account.key(),
                num_players: 1,
            });
        } else if game_queue_account_three.current_player == game_account.key() {
            // Add a new player as player 3
            game_queue_account_three.current_player = player_account.key();
            game_queue_account_three.last_player = player_account.key();
            game_queue_account_three.num_players_in_queue = 1;

            // emit an event to make known a player has joined game queue 3
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_three.key(),
                queue_num: 3,
                last_player: player_account.key(),
                num_players: 1,
            });
        } else if game_queue_account_four.current_player == game_account.key() {
            // Add a new player as player 4
            game_queue_account_four.current_player = player_account.key();
            game_queue_account_four.last_player = player_account.key();
            game_queue_account_four.num_players_in_queue = 1;

            // emit an event to make known a player has joined game queue 4
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_four.key(),
                queue_num: 4,
                last_player: player_account.key(),
                num_players: 1,
            });
        } else if game_queue_account_one.num_players_in_queue == game_queue_account_two.num_players_in_queue &&
                  game_queue_account_two.num_players_in_queue == game_queue_account_three.num_players_in_queue &&
                  game_queue_account_three.num_players_in_queue == game_queue_account_four.num_players_in_queue {
            // Add a new player behind player 1.
            q1_last_player.next_player = Some(player_account.key());
            game_queue_account_one.last_player = player_account.key();
            game_queue_account_one.num_players_in_queue += 1;

            // emit an event to make known a player has joined game queue 1
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_one.key(),
                queue_num: 1,
                last_player: player_account.key(),
                num_players: game_queue_account_one.num_players_in_queue,
            });
        } else if game_queue_account_two.num_players_in_queue == game_queue_account_three.num_players_in_queue &&
                  game_queue_account_three.num_players_in_queue == game_queue_account_four.num_players_in_queue {
            // Add a new player behind player 2
            q2_last_player.next_player = Some(player_account.key());
            game_queue_account_two.last_player = player_account.key();
            game_queue_account_two.num_players_in_queue += 1;

            // emit an event to make known a player has joined game queue 2
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_two.key(),
                queue_num: 2,
                last_player: player_account.key(),
                num_players: game_queue_account_two.num_players_in_queue,
            });
        } else if game_queue_account_three.num_players_in_queue == game_queue_account_four.num_players_in_queue {
            // Add a new player behind player 3
            q3_last_player.next_player = Some(player_account.key());
            game_queue_account_three.last_player = player_account.key();
            game_queue_account_three.num_players_in_queue += 1;

            // emit an event to make known a player has joined game queue 3
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_three.key(),
                queue_num: 3,
                last_player: player_account.key(),
                num_players: game_queue_account_three.num_players_in_queue,
            });
        } else {
            q4_last_player.next_player = Some(player_account.key());
            game_queue_account_four.last_player = player_account.key();
            game_queue_account_four.num_players_in_queue += 1;

            // emit an event to make known a player has joined game queue 4
            emit!(JoinQueueEvent {
                game_id: game_account.key(),
                queue_id: game_queue_account_four.key(),
                queue_num: 4,
                last_player: player_account.key(),
                num_players: game_queue_account_four.num_players_in_queue,
            });
        }

        Ok(())
    }

    /// Advances a normal 4 player game queue
    /// 
    /// I J K L ->         -> 
    /// E F G H -> I J K L -> 
    /// A B C D -> E F G H -> I J K L 
    pub fn advance_four_player_game_queue(ctx: Context<AdvanceFourPlayerGameQueue>) -> Result<()> {
        let player_one = &mut ctx.accounts.player_one;
        let player_two = &mut ctx.accounts.player_two;
        let player_three = &mut ctx.accounts.player_three;
        let player_four = &mut ctx.accounts.player_four;
        let game_queue_account_one = &mut ctx.accounts.game_queue_account_one;
        let game_queue_account_two = &mut ctx.accounts.game_queue_account_two;
        let game_queue_account_three = &mut ctx.accounts.game_queue_account_three;
        let game_queue_account_four = &mut ctx.accounts.game_queue_account_four;
        let game_account = & ctx.accounts.game_account;

        (game_queue_account_one.current_player, game_queue_account_one.last_player, game_queue_account_one.num_players_in_queue) = match player_one.next_player {
            Some(player) => (player, game_queue_account_one.last_player, game_queue_account_one.num_players_in_queue - 1),
            None => return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into()),
        };

        (game_queue_account_two.current_player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue) = match player_two.next_player {
            Some(player) => (player, game_queue_account_two.last_player, game_queue_account_two.num_players_in_queue - 1),
            None => (game_account.key(), game_account.key(), 0),
        };

        (game_queue_account_three.current_player, game_queue_account_three.last_player, game_queue_account_three.num_players_in_queue) = match player_three.next_player {
            Some(player) => (player, game_queue_account_three.last_player, game_queue_account_three.num_players_in_queue - 1),
            None => (game_account.key(), game_account.key(), 0),
        };

        (game_queue_account_four.current_player, game_queue_account_four.last_player, game_queue_account_four.num_players_in_queue) = match player_four.next_player {
            Some(player) => (player, game_queue_account_four.last_player, game_queue_account_four.num_players_in_queue - 1),
            None => (game_account.key(), game_account.key(), 0),
        };

        // emit an event to make known that the game queue has been advanced
        emit!(AdvanceQueueEvent {
            game_id: game_account.key(),
            queue_ids: vec![
                game_queue_account_one.key(),
                game_queue_account_two.key(),
                game_queue_account_three.key(),
                game_queue_account_four.key(),
            ],
            queue_nums: vec![1, 2, 3, 4],
            finished_players: vec![
                Some(player_one.key()),
                Some(player_two.key()),
                Some(player_three.key()),
                Some(player_four.key()),
            ],
            new_players: vec![
                player_one.next_player,
                player_two.next_player,
                player_three.next_player,
                player_four.next_player,
            ],
            num_players: vec![
                game_queue_account_one.num_players_in_queue,
                game_queue_account_two.num_players_in_queue,
                game_queue_account_three.num_players_in_queue,
                game_queue_account_four.num_players_in_queue,
            ],
        });

        Ok(())
    }

    /// Advances a 4 player king of the hill game.
    /// 
    /// I J K L -> I       -> I       ->         ->         ->
    /// E F G H -> E J K L -> E       ->   I     ->         -> 
    /// A B C D -> A F G H -> A J K L -> A E _ _ -> A I _ _ -> A
    pub fn advance_four_player_king_of_hill_queue(ctx: Context<AdvanceFourPlayerKingOfHillQueue>) -> Result<()> {
        let winning_player = &mut ctx.accounts.winning_player;
        let losing_player_one = &mut ctx.accounts.losing_player_one;
        let losing_player_two = &mut ctx.accounts.losing_player_two;
        let losing_player_three = &mut ctx.accounts.losing_player_three;
        let queues = [
            &mut ctx.accounts.game_queue_account_one,
            &mut ctx.accounts.game_queue_account_two,
            &mut ctx.accounts.game_queue_account_three,
            &mut ctx.accounts.game_queue_account_four
        ];
        let game_account = & ctx.accounts.game_account;
        let mut player_mappings = [0, 0, 0, 0];
        let mut winning_queue_num = 0;

        for i in 0..4 {
            if queues[i].current_player == winning_player.key() {
                player_mappings[i] = 1;
                winning_queue_num = i;
            } else if queues[i].current_player == losing_player_one.key() {
                player_mappings[i] = 2;
            } else if queues[i].current_player == losing_player_two.key() {
                player_mappings[i] = 3;
            } else if queues[i].current_player == losing_player_three.key() {
                player_mappings[i] = 4;
            } else if queues[i].current_player == game_account.key() {
                player_mappings[i] = 5;
            } else {
                return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
            }
        }

        let mut queue_ids = Vec::with_capacity(3);
        let mut queue_nums = Vec::with_capacity(3);
        let mut finished_players = Vec::with_capacity(3);
        let mut new_players = Vec::with_capacity(3);
        let mut num_players = Vec::with_capacity(3);

        for i in 0..4 {
            match player_mappings[i] {
                2 => {
                    (queues[i].current_player, queues[i].last_player, queues[i].num_players_in_queue) = match losing_player_one.next_player {
                        Some(player) => (player, queues[i].last_player, queues[i].num_players_in_queue - 1),
                        None => match winning_player.next_player {
                            Some(player) => {
                                let old_last_player = queues[winning_queue_num].last_player;
                                let old_num_players = queues[winning_queue_num].num_players_in_queue - 1;

                                winning_player.next_player = None;
                                queues[winning_queue_num].last_player = winning_player.key();
                                queues[winning_queue_num].num_players_in_queue = 1;

                                (player, old_last_player, old_num_players)
                            },
                            None => (game_account.key(), game_account.key(), 0),
                        },
                    };

                    queue_ids.push(queues[i].key());
                    queue_nums.push(i as u8);
                    finished_players.push(Some(losing_player_one.key()));
                    new_players.push(if queues[i].current_player != game_account.key() { Some(queues[i].current_player) } else { None });
                    num_players.push(queues[i].num_players_in_queue);
                },
                3 => {
                    (queues[i].current_player, queues[i].last_player, queues[i].num_players_in_queue) = match losing_player_two.next_player {
                        Some(player) => (player, queues[i].last_player, queues[i].num_players_in_queue - 1),
                        None => match winning_player.next_player {
                            Some(player) => {
                                let old_last_player = queues[winning_queue_num].last_player;
                                let old_num_players = queues[winning_queue_num].num_players_in_queue - 1;

                                winning_player.next_player = None;
                                queues[winning_queue_num].last_player = winning_player.key();
                                queues[winning_queue_num].num_players_in_queue = 1;

                                (player, old_last_player, old_num_players)
                            },
                            None => (game_account.key(), game_account.key(), 0),
                        },
                    };

                    queue_ids.push(queues[i].key());
                    queue_nums.push(i as u8);
                    finished_players.push(Some(losing_player_two.key()));
                    new_players.push(if queues[i].current_player != game_account.key() { Some(queues[i].current_player) } else { None });
                    num_players.push(queues[i].num_players_in_queue);
                },
                4 => {
                    (queues[i].current_player, queues[i].last_player, queues[i].num_players_in_queue) = match losing_player_three.next_player {
                        Some(player) => (player, queues[i].last_player, queues[i].num_players_in_queue - 1),
                        None => match winning_player.next_player {
                            Some(player) => {
                                let old_last_player = queues[winning_queue_num].last_player;
                                let old_num_players = queues[winning_queue_num].num_players_in_queue - 1;

                                winning_player.next_player = None;
                                queues[winning_queue_num].last_player = winning_player.key();
                                queues[winning_queue_num].num_players_in_queue = 1;

                                (player, old_last_player, old_num_players)
                            },
                            None => (game_account.key(), game_account.key(), 0),
                        },
                    };

                    queue_ids.push(queues[i].key());
                    queue_nums.push(i as u8);
                    finished_players.push(Some(losing_player_three.key()));
                    new_players.push(if queues[i].current_player != game_account.key() { Some(queues[i].current_player) } else { None });
                    num_players.push(queues[i].num_players_in_queue);
                },
                _ => continue,
            }
        }

        // emit an event to make known that the game queue has advanced
        emit!(AdvanceQueueEvent {
            game_id: game_account.key(),
            queue_ids: queue_ids,
            queue_nums: queue_nums,
            finished_players: finished_players,
            new_players: new_players,
            num_players: num_players,
        });

        Ok(())
    }

    /// We have given up on making the queue flow smoothly, basically you will register in queue for a specific team and wait for the people in front of
    /// you to fail.
    /// 
    /// TODO: Maybe we can fix the queue advancing but it honestly looks quite difficult.
    pub fn advance_team_king_of_hill_queue(ctx: Context<AdvanceTeamKingOfHillQueue>) -> Result<()> {
        let winning_player_one = &mut ctx.accounts.winning_player_one;
        let winning_player_two = &mut ctx.accounts.winning_player_two;
        let losing_player_one = &mut ctx.accounts.losing_player_one;
        let losing_player_two = &mut ctx.accounts.losing_player_two;
        let queues = [
            &mut ctx.accounts.game_queue_account_one,
            &mut ctx.accounts.game_queue_account_two,
            &mut ctx.accounts.game_queue_account_three,
            &mut ctx.accounts.game_queue_account_four
        ];
        let game_account = & ctx.accounts.game_account;
        let mut player_mappings = [0, 0, 0, 0];
        let mut winning_queue_nums = [0, 0];

        for i in 0..4 {
            if queues[i].current_player == winning_player_one.key() {
                player_mappings[i] = 1;
                winning_queue_nums[0] = i;
            } else if queues[i].current_player == winning_player_two.key() {
                player_mappings[i] = 2;
                winning_queue_nums[1] = i;
            } else if queues[i].current_player == losing_player_one.key() {
                player_mappings[i] = 3;
            } else if queues[i].current_player == losing_player_two.key() {
                player_mappings[i] = 4;
            } else if queues[i].current_player == game_account.key() {
                player_mappings[i] = 5;
            } else {
                return Err(Errors::CannotAdvanceGameQueueIncorrectPlayers.into());
            }
        }

        let mut queue_ids = Vec::with_capacity(2);
        let mut queue_nums = Vec::with_capacity(2);
        let mut finished_players = Vec::with_capacity(2);
        let mut new_players = Vec::with_capacity(2);
        let mut num_players = Vec::with_capacity(2);

        for i in [0, 2] {
            if player_mappings[i] == 3 {
                (
                    queues[i].current_player, queues[i].last_player, queues[i].num_players_in_queue,
                    queues[i+1].current_player, queues[i+1].last_player, queues[i+1].num_players_in_queue
                ) = match (losing_player_one.next_player, losing_player_two.next_player) {
                    (Some(player_one), Some(player_two)) => (
                        player_one, queues[i].last_player, queues[i].num_players_in_queue - 1,
                        player_two, queues[i+1].last_player, queues[i+1].num_players_in_queue - 1
                    ),
                    (Some(player_one), None) => (
                        player_one, queues[i].last_player, queues[i].num_players_in_queue - 1,
                        game_account.key(), game_account.key(), 0
                    ),
                    (None, Some(player_two)) => (
                        game_account.key(), game_account.key(), 0,
                        player_two, queues[i+1].last_player, queues[i+1].num_players_in_queue - 1,
                    ),
                    (None, None) => {
                        match (winning_player_one.next_player, winning_player_two.next_player) {
                            (Some(player_one), Some(player_two)) => {
                                if player_one != player_two {
                                    let old_last_player_one = queues[winning_queue_nums[0]].last_player;
                                    let old_last_player_two = queues[winning_queue_nums[1]].last_player;
                                    let old_num_players_one = queues[winning_queue_nums[0]].num_players_in_queue - 1;
                                    let old_num_players_two = queues[winning_queue_nums[1]].num_players_in_queue - 1;

                                    winning_player_one.next_player = None;
                                    winning_player_two.next_player = None;
                                    queues[winning_queue_nums[0]].num_players_in_queue = 1;
                                    queues[winning_queue_nums[1]].num_players_in_queue = 1;
                                    queues[winning_queue_nums[0]].last_player = winning_player_one.key();
                                    queues[winning_queue_nums[1]].last_player = winning_player_two.key();

                                    (
                                        player_one, old_last_player_one, old_num_players_one,
                                        player_two, old_last_player_two, old_num_players_two
                                    )
                                } else {
                                    (
                                        game_account.key(), game_account.key(), 0,
                                        game_account.key(), game_account.key(), 0
                                    )
                                }
                            },
                            (Some(player_one), None) => {
                                let old_last_player_one = queues[winning_queue_nums[0]].last_player;
                                let old_num_players_one = queues[winning_queue_nums[0]].num_players_in_queue - 1;

                                winning_player_one.next_player = None;
                                queues[winning_queue_nums[0]].num_players_in_queue = 1;
                                queues[winning_queue_nums[0]].last_player = winning_player_one.key();

                                (
                                    player_one, old_last_player_one, old_num_players_one,
                                    game_account.key(), game_account.key(), 0
                                )
                            },
                            (None, Some(player_two)) => {
                                let old_last_player_two = queues[winning_queue_nums[1]].last_player;
                                let old_num_players_two = queues[winning_queue_nums[1]].num_players_in_queue - 1;

                                winning_player_two.next_player = None;
                                queues[winning_queue_nums[1]].num_players_in_queue = 1;
                                queues[winning_queue_nums[1]].last_player = winning_player_two.key();

                                (
                                    game_account.key(), game_account.key(), 0,
                                    player_two, old_last_player_two, old_num_players_two
                                )
                            },
                            (None, None) => (
                                game_account.key(), game_account.key(), 0,
                                game_account.key(), game_account.key(), 0
                            ),
                        }
                    },
                };

                queue_ids.push(queues[i].key());
                queue_ids.push(queues[i+1].key());
                queue_nums.push((i+1) as u8);
                queue_nums.push((i+2) as u8);
                finished_players.push(Some(losing_player_one.key()));
                finished_players.push(Some(losing_player_two.key()));
                new_players.push(if queues[i].current_player != game_account.key() { Some(queues[i].current_player) } else { None });
                new_players.push(if queues[i+1].current_player != game_account.key() { Some(queues[i+1].current_player) } else { None });
                num_players.push(queues[i].num_players_in_queue);
                num_players.push(queues[i+1].num_players_in_queue);
            } else if player_mappings[i] == 4 {
                (
                    queues[i].current_player, queues[i].last_player, queues[i].num_players_in_queue,
                    queues[i+1].current_player, queues[i+1].last_player, queues[i+1].num_players_in_queue
                ) = match (losing_player_two.next_player, losing_player_one.next_player) {
                    (Some(player_one), Some(player_two)) => (
                        player_one, queues[i].last_player, queues[i].num_players_in_queue - 1,
                        player_two, queues[i+1].last_player, queues[i+1].num_players_in_queue - 1
                    ),
                    (Some(player_one), None) => (
                        player_one, queues[i].last_player, queues[i].num_players_in_queue - 1,
                        game_account.key(), game_account.key(), 0
                    ),
                    (None, Some(player_two)) => (
                        game_account.key(), game_account.key(), 0,
                        player_two, queues[i+1].last_player, queues[i+1].num_players_in_queue - 1,
                    ),
                    (None, None) => {
                        match (winning_player_one.next_player, winning_player_two.next_player) {
                            (Some(player_one), Some(player_two)) => {
                                if player_one != player_two {
                                    let old_last_player_one = queues[winning_queue_nums[0]].last_player;
                                    let old_last_player_two = queues[winning_queue_nums[1]].last_player;
                                    let old_num_players_one = queues[winning_queue_nums[0]].num_players_in_queue - 1;
                                    let old_num_players_two = queues[winning_queue_nums[1]].num_players_in_queue - 1;

                                    winning_player_one.next_player = None;
                                    winning_player_two.next_player = None;
                                    queues[winning_queue_nums[0]].num_players_in_queue = 1;
                                    queues[winning_queue_nums[1]].num_players_in_queue = 1;
                                    queues[winning_queue_nums[0]].last_player = winning_player_one.key();
                                    queues[winning_queue_nums[1]].last_player = winning_player_two.key();

                                    (
                                        player_one, old_last_player_one, old_num_players_one,
                                        player_two, old_last_player_two, old_num_players_two
                                    )
                                } else {
                                    (
                                        game_account.key(), game_account.key(), 0,
                                        game_account.key(), game_account.key(), 0
                                    )
                                }
                            },
                            (Some(player_one), None) => {
                                let old_last_player_one = queues[winning_queue_nums[0]].last_player;
                                let old_num_players_one = queues[winning_queue_nums[0]].num_players_in_queue - 1;

                                winning_player_one.next_player = None;
                                queues[winning_queue_nums[0]].num_players_in_queue = 1;
                                queues[winning_queue_nums[0]].last_player = winning_player_one.key();

                                (
                                    player_one, old_last_player_one, old_num_players_one,
                                    game_account.key(), game_account.key(), 0
                                )
                            },
                            (None, Some(player_two)) => {
                                let old_last_player_two = queues[winning_queue_nums[1]].last_player;
                                let old_num_players_two = queues[winning_queue_nums[1]].num_players_in_queue - 1;

                                winning_player_two.next_player = None;
                                queues[winning_queue_nums[1]].num_players_in_queue = 1;
                                queues[winning_queue_nums[1]].last_player = winning_player_two.key();

                                (
                                    game_account.key(), game_account.key(), 0,
                                    player_two, old_last_player_two, old_num_players_two
                                )
                            },
                            (None, None) => (
                                game_account.key(), game_account.key(), 0,
                                game_account.key(), game_account.key(), 0
                            ),
                        }
                    },
                };

                queue_ids.push(queues[i].key());
                queue_ids.push(queues[i+1].key());
                queue_nums.push((i+1) as u8);
                queue_nums.push((i+2) as u8);
                finished_players.push(Some(losing_player_one.key()));
                finished_players.push(Some(losing_player_two.key()));
                new_players.push(if queues[i].current_player != game_account.key() { Some(queues[i].current_player) } else { None });
                new_players.push(if queues[i+1].current_player != game_account.key() { Some(queues[i+1].current_player) } else { None });
                num_players.push(queues[i].num_players_in_queue);
                num_players.push(queues[i+1].num_players_in_queue);
            }
        }

        // emit an event to make known the queue has advanced
        emit!(AdvanceQueueEvent {
            game_id: game_account.key(),
            queue_ids: queue_ids,
            queue_nums: queue_nums,
            finished_players: finished_players,
            new_players: new_players,
            num_players: num_players,
        });

        Ok(())
    }

    /// Finishes a normal 4 player game queue by resetting the queue pointers.
    pub fn finish_four_player_game_queue(ctx: Context<FinishFourPlayerGameQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        for i in 0..4 {
            game_account.game_queues[i] = game_account.key();
        }

        // emit an event to make known the queues have been destroyed
        emit!(FinishQueueEvent {
            game_id: game_account.key(),
        });

        Ok(())
    }

    /// Finishes a 4 player king of the hill queue by resetting the queue pointers.
    pub fn finish_four_player_king_of_hill_queue(ctx: Context<FinishFourPlayerKingOfHillQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        for i in 0..4 {
            game_account.game_queues[i] = game_account.key();
        }

        // emit an event to make known the queues have been destroyed
        emit!(FinishQueueEvent {
            game_id: game_account.key(),
        });

        Ok(())
    }

    /// Finishes a team king of the hill queue by resetting the queue pointers.
    pub fn finish_team_king_of_hill_queue(ctx: Context<FinishTeamKingOfHillQueue>) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;

        for i in 0..4 {
            game_account.game_queues[i] = game_account.key();
        }

        // emit an event to make known the queues have been destroyed
        emit!(FinishQueueEvent {
            game_id: game_account.key(),
        });

        Ok(())
    }

    /// Joins a specific queue for a king of the hill game.
    pub fn join_king_of_hill_game_queue(ctx: Context<JoinKingOfHillGameQueue>) -> Result<()> {
        let player_account = &mut ctx.accounts.player_account;
        let last_player = &mut ctx.accounts.last_player;
        let game_queue_account = &mut ctx.accounts.game_queue_account;
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        let mut correct_game_queue = false;
        let mut queue_num: u8 = 0;

        for i in 0..(game_account.max_players as usize) {
            if (*game_account.game_queues.get(i).unwrap()) == game_queue_account.key() {
                correct_game_queue = true;
                queue_num = i as u8;
                break;
            }
        }

        if !correct_game_queue {
            return Err(Errors::CannotAdvanceGameQueueWrongGameQueue.into());
        }

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            TWENTY_FIVE_CENTS,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        player_account.wallet_key = payer.key();
        player_account.next_player = None;

        if game_queue_account.current_player == game_account.key() {
            game_queue_account.current_player = player_account.key();
        }

        if game_queue_account.last_player == last_player.key() {
            last_player.next_player = Some(player_account.key());
        }
        game_queue_account.last_player = player_account.key();
        game_queue_account.num_players_in_queue += 1;

        // emit an event to make known the queue has been joined
        emit!(JoinQueueEvent {
            game_id: game_account.key(),
            queue_id: game_queue_account.key(),
            queue_num: queue_num,
            last_player: player_account.key(),
            num_players: game_queue_account.num_players_in_queue,
        });

        Ok(())
    }

    /// Whenever a game is played the game should make a call to the update leaderboard function to see if the leaderboard
    /// should be updated.
    pub fn update_leaderboard(ctx: Context<GameEnd>, player_name: String, score: u128, wallet_key: Pubkey) -> Result<()> {
        let game_account = &mut ctx.accounts.game_account;

        let name = match player_name.chars().count() {
            1 => player_name + "  ",
            2 => player_name + " ",
            3 => player_name,
            _ => return Err(Errors::IllegalName.into()),
        };

        let first = game_account.leaderboard.first_place.score;
        let second = game_account.leaderboard.second_place.score;
        let third = game_account.leaderboard.third_place.score;

        if score > third {
            let place = Place {name: name.clone(), wallet_key, score};

            if score > first {
                game_account.leaderboard.third_place = game_account.leaderboard.second_place.clone();
                game_account.leaderboard.second_place = game_account.leaderboard.first_place.clone();
                game_account.leaderboard.first_place = place.clone();
            } else if score > second {
                game_account.leaderboard.third_place = game_account.leaderboard.second_place.clone();
                game_account.leaderboard.second_place = place.clone();
            } else {
                game_account.leaderboard.third_place = place.clone();
            }
        }

        // emit an event to make known the leaderboard has been updated
        emit!(LeaderboardEvent {
            game_id: game_account.key(),
            player_name: name,
            first_place_name: game_account.leaderboard.first_place.name.to_string(),
            second_place_name: game_account.leaderboard.second_place.name.to_string(),
            third_place_name: game_account.leaderboard.third_place.name.to_string(),
        });

        Ok(())
    }

    /// Whenever the owner of a game wants to payout the funds they will call this function
    pub fn payback_funds(ctx: Context<PaybackGameFunds>) -> Result<()> {
        let player_one_pot = &mut ctx.accounts.player_one_pot;
        let player_two_pot = &mut ctx.accounts.player_two_pot;
        let player_three_pot = &mut ctx.accounts.player_three_pot;
        let arcade_account = &mut ctx.accounts.arcade_account;
        let game_account = &mut ctx.accounts.game_account;
        let owner_account = &mut ctx.accounts.owner;

        // Calculate amount SOL to give to game owner, top player, second player, and third player
        let game_lamports = game_account.to_account_info().lamports();
        let rent_calculator = Rent::default();
        let minimum_game_rent = rent_calculator.minimum_balance(Game::MAX_SIZE + 8);
        let minimum_pot_rent = rent_calculator.minimum_balance(GamePot::MAX_SIZE + 8);
        let distribution_lamports = game_lamports - minimum_game_rent;
        let owner_lamports = (distribution_lamports / 2) as u64;
        let player_one_lamports= (owner_lamports * 4 / 7) as u64;
        let player_two_lamports = (owner_lamports * 2 / 7) as u64;
        let player_three_lamports = (owner_lamports / 7) as u64;
        
        let paying_lamports = owner_lamports + player_one_lamports + player_three_lamports;
        if minimum_game_rent > game_lamports - paying_lamports {
            return Err(Errors::InsufficientFundsForPayout.into());
        } else if minimum_pot_rent > player_one_lamports {
            return Err(Errors::InsufficientFundsPotOne.into());
        } else if minimum_pot_rent > player_two_lamports {
            return Err(Errors::InsufficientFundsPotTwo.into());
        } else if minimum_pot_rent > player_three_lamports {
            return Err(Errors::InsufficientFundsPotThree.into());
        }

        **owner_account.to_account_info().lamports.borrow_mut() += owner_lamports;
        **player_one_pot.to_account_info().lamports.borrow_mut() += player_one_lamports;
        **player_two_pot.to_account_info().lamports.borrow_mut() += player_two_lamports;
        **player_three_pot.to_account_info().lamports.borrow_mut() += player_three_lamports;
        **game_account.to_account_info().lamports.borrow_mut() -= owner_lamports + player_one_lamports + player_two_lamports + player_three_lamports;

        player_one_pot.game = game_account.key();
        player_one_pot.winner_wallet = game_account.leaderboard.first_place.wallet_key;
        player_one_pot.next_game_pot = Some(player_two_pot.key());

        player_two_pot.game = game_account.key();
        player_two_pot.winner_wallet = game_account.leaderboard.second_place.wallet_key;
        player_two_pot.next_game_pot = Some(player_three_pot.key());

        player_three_pot.game = game_account.key();
        player_three_pot.winner_wallet = game_account.leaderboard.third_place.wallet_key;
        player_three_pot.next_game_pot = arcade_account.most_recent_game_pot_key;

        arcade_account.most_recent_game_pot_key = Some(player_one_pot.key());

        emit!(PayoutEvent {
            game_name: game_account.title.clone(),
            arcade_id: arcade_account.key(),
            player_one_pot_key: player_one_pot.key(),
            player_two_pot_key: player_two_pot.key(),
            player_three_pot_key: player_three_pot.key(),
            player_one_name: game_account.leaderboard.first_place.name.clone(),
            player_two_name: game_account.leaderboard.second_place.name.clone(),
            player_three_name: game_account.leaderboard.third_place.name.clone(),
        });

        let first_place = Place {name: String::from("AAA"), wallet_key: owner_account.key(), score: 100};
        let second_place = Place {name: String::from("BBB"), wallet_key: owner_account.key(), score: 50};
        let third_place = Place {name: String::from("CCC"), wallet_key: owner_account.key(), score: 25};

        let leaderboard = Leaderboard {first_place, second_place, third_place};

        game_account.leaderboard = leaderboard;

        Ok(())
    }

    /// Whenever a user wants to cash out their pots they can call this function to do so.
    pub fn cash_out_pot(ctx: Context<CashOutPot>) -> Result<()> {
        let game_pot_account = &mut ctx.accounts.game_pot_account;
        let previous_pot_account = &mut ctx.accounts.previous_pot_account;

        previous_pot_account.next_game_pot = game_pot_account.next_game_pot;

        Ok(())
    }

    /// Whenever a user wants to cash out their pots they can call this function to do so if that pot is the first one.
    pub fn cash_out_most_recent_pot(ctx: Context<CashOutMostRecentPot>) -> Result<()> {
        let game_pot_account = &mut ctx.accounts.game_pot_account;
        let arcade_state = &mut ctx.accounts.arcade_state;

        arcade_state.most_recent_game_pot_key = game_pot_account.next_game_pot;

        Ok(())
    }

    pub fn refill_game_funds(ctx: Context<RefillGameFunds>, lamports: u64) -> ProgramResult {
        let game_account = &mut ctx.accounts.game_account;
        let payer = &mut ctx.accounts.payer;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &payer.key(),
            &game_account.key(),
            lamports,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                payer.to_account_info(),
                game_account.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
/// Context used to initialize the arcade.
pub struct InitArcade<'info> {
    #[account(init, payer = authority, space = 8 + ArcadeState::MAX_SIZE)]
    pub arcade_account: Account<'info, ArcadeState>, // The accound for the arcade state (i.e. the pointer to the newest game).
    #[account(init, payer = authority, space = 8 + Game::MAX_SIZE)]
    pub genesis_game_account: Account<'info, Game>, // The first game (i.e. the game that began the arcade).
    #[account(mut)]
    pub authority: Signer<'info>, // The person who pays for initializing the arcade (i.e. me).
    pub system_program: Program<'info, System>, // The system program to make sure the account created is associated with this program.
}

#[derive(Accounts)]
/// Context used to create a new game.
pub struct MakeGame<'info> {
    #[account(init, payer = owner, space = 8 + Game::MAX_SIZE)]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub arcade_account: Account<'info, ArcadeState>,
    #[account(mut)]
    pub most_recent_game_account: Account<'info, Game>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to delete a game.
pub struct DeleteGame<'info> {
    #[account(
        mut,
        close = owner,
        constraint = game_account.key() == younger_game.older_game_key,
        constraint = game_account.key() == older_game.younger_game_key,
        constraint = game_account.owner_wallet == owner.key(),
    )]
    pub game_account: Box<Account<'info, Game>>,
    #[account(mut)]
    pub younger_game: Account<'info, Game>,
    #[account(mut)]
    pub older_game: Account<'info, Game>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to delete the most recent game in an arcade.
pub struct DeleteMostRecentGame<'info> {
    #[account(
        mut,
        close = owner,
        constraint = game_account.key() == older_game.younger_game_key,
        constraint = game_account.owner_wallet == owner.key(),
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    arcade_state: Account<'info, ArcadeState>,
    #[account(mut)]
    pub older_game: Account<'info, Game>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to signify a game has ended and it is time to update the leaderboard.
pub struct GameEnd<'info> {
    #[account(mut)]
    pub game_account: Account<'info, Game>,
    #[account(mut, constraint = authority.key() == game_account.key())]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to initialize the queue of a 1 player normal game.
pub struct InitOnePlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 1,
        constraint = (game_account.game_queues.get(0) == None) || ((*game_account.game_queues.get(0).unwrap()) == game_account.key())
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to join a 1 player normal game queue.
pub struct JoinOnePlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(mut, constraint = last_player.next_player == None)]
    pub last_player: Account<'info, Player>,
    #[account(mut, constraint = game_queue_account.last_player == last_player.key())]
    pub game_queue_account: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 1,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account.key()
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a 1 player normal game queue.
pub struct AdvanceOnePlayerGameQueue<'info> {
    #[account(mut, close = game_account)]
    pub current_player: Account<'info, Player>,
    #[account(
        mut,
        constraint = game_queue_account.current_player == current_player.key(),
        constraint = game_queue_account.game == game_account.key()
    )]
    pub game_queue_account: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 1,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to finish (destroy queues) for a 1 player normal game.
pub struct FinishOnePlayerGameQueue<'info> {
    #[account(
        mut,
        close = game_account,
        constraint = current_player.next_player == None
    )]
    pub current_player: Account<'info, Player>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account.current_player == current_player.key(),
        constraint = game_queue_account.last_player == current_player.key(),
        constraint = game_queue_account.game == game_account.key()
    )]
    pub game_queue_account: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 1,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to initialize the game queues of a 2 player game.
pub struct InitTwoPlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 2,
        constraint = (game_account.game_queues.get(0) == None) || ((*game_account.game_queues.get(0).unwrap()) == game_account.key()),
        constraint = (game_account.game_queues.get(1) == None) || ((*game_account.game_queues.get(1).unwrap()) == game_account.key())
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to join a normal 2 player game.
pub struct JoinTwoPlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(mut, constraint = q1_last_player.next_player == None)]
    pub q1_last_player: Account<'info, Player>,
    #[account(mut, constraint = q2_last_player.next_player == None)]
    pub q2_last_player: Account<'info, Player>,
    #[account(mut, constraint = game_queue_account_one.last_player == q1_last_player.key())]
    pub game_queue_account_one: Account<'info, GameQueue>,
    // constraint = game_queue_account_two.last_player == q2_last_player.key() has been removed to allow for situations where second player does not
    // exist to be handeled by sending in the same player as q1 and q2 last players.
    #[account(mut)]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 2,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key()
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a normal 2 player game.
pub struct AdvanceTwoPlayerGameQueue<'info> {
    #[account(mut, close = game_account)]
    pub player_one: Account<'info, Player>,
    #[account(mut, close = game_account)]
    pub player_two: Account<'info, Player>,
    #[account(
        mut,
        constraint = game_queue_account_one.current_player == player_one.key() @Errors::CannotAdvanceGameQueueIncorrectPlayers,
        constraint = game_queue_account_one.game == game_account.key() @Errors::CannotAdvanceGameQueueIncorrectGameKey
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.current_player == player_two.key() @Errors::CannotAdvanceGameQueueIncorrectPlayers,
        constraint = game_queue_account_two.game == game_account.key() @Errors::CannotAdvanceGameQueueIncorrectGameKey
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 2 @Errors::CannotAdvanceGameQueueWrongMaxPlayers,
        constraint = game_account.game_type == 0 @Errors::CannotAdvanceGameQueueWrongGameType,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key() @Errors::CannotAdvanceGameQueueWrongGameQueue,
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key() @Errors::CannotAdvanceGameQueueWrongGameQueue
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a king of the hill 2 player game.
pub struct AdvanceTwoPlayerKingOfHillQueue<'info> {
    #[account(mut)]
    pub winning_player: Account<'info, Player>,
    #[account(mut, close = game_account)]
    pub losing_player: Account<'info, Player>,
    #[account(
        mut,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 2,
        constraint = game_account.game_type == 1,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to finish (destroy queues) of a normal 2 player game.
pub struct FinishTwoPlayerGameQueue<'info> {
    #[account(
        mut,
        close = game_account,
        constraint = player_one.next_player == None
    )]
    pub player_one: Account<'info, Player>,
    #[account(
        mut,
        close = game_account,
        constraint = player_two.next_player == None
    )]
    pub player_two: Account<'info, Player>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_one.current_player == player_one.key(),
        constraint = game_queue_account_one.last_player == player_one.key(),
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = (game_queue_account_two.current_player == player_two.key()) || (game_queue_account_two.current_player == game_account.key()),
        constraint = (game_queue_account_two.last_player == player_two.key()) || (game_queue_account_two.last_player == game_account.key()),
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 2,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to finish (destroy queues) of a king of the hill 2 player game.
pub struct FinishTwoPlayerKingOfHillQueue<'info> {
    #[account(mut, close = game_account)]
    pub losing_player: Account<'info, Player>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 2,
        constraint = game_account.game_type == 1,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to initialize the queues for a 3 player game.
pub struct InitThreePlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 3,
        constraint = (game_account.game_queues.get(0) == None) || ((*game_account.game_queues.get(0).unwrap()) == game_account.key()),
        constraint = (game_account.game_queues.get(1) == None) || ((*game_account.game_queues.get(1).unwrap()) == game_account.key()),
        constraint = (game_account.game_queues.get(2) == None) || ((*game_account.game_queues.get(2).unwrap()) == game_account.key())
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to join a normal 3 player game.
pub struct JoinThreePlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(mut, constraint = q1_last_player.next_player == None)]
    pub q1_last_player: Account<'info, Player>,
    #[account(mut, constraint = q2_last_player.next_player == None)]
    pub q2_last_player: Account<'info, Player>,
    #[account(mut, constraint = q3_last_player.next_player == None)]
    pub q3_last_player: Account<'info, Player>,
    #[account(mut, constraint = game_queue_account_one.last_player == q1_last_player.key())]
    pub game_queue_account_one: Box<Account<'info, GameQueue>>,
    #[account(mut)]
    pub game_queue_account_two: Box<Account<'info, GameQueue>>,
    #[account(mut)]
    pub game_queue_account_three: Box<Account<'info, GameQueue>>,
    #[account(
        mut,
        constraint = game_account.max_players == 3,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key()
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a normal 3 player game queue.
pub struct AdvanceThreePlayerGameQueue<'info> {
    #[account(mut, close = game_account)]
    pub player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub player_two: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub player_three: Box<Account<'info, Player>>,
    #[account(
        mut,
        constraint = game_queue_account_one.current_player == player_one.key(),
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.current_player == player_two.key(),
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_three.current_player == player_three.key(),
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 3,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a king of the hill 3 player game.
pub struct AdvanceThreePlayerKingOfHillQueue<'info> {
    #[account(mut)]
    pub winning_player: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_two: Box<Account<'info, Player>>,
    #[account(
        mut,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 3,
        constraint = game_account.game_type == 1,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to finish (destroy queues) of a normal 3 player game.
pub struct FinishThreePlayerGameQueue<'info> {
    #[account(
        mut,
        close = game_account,
        constraint = player_one.next_player == None
    )]
    pub player_one: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = player_two.next_player == None
    )]
    pub player_two: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = player_three.next_player == None
    )]
    pub player_three: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_one.current_player == player_one.key(),
        constraint = game_queue_account_one.last_player == player_one.key(),
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = (game_queue_account_two.current_player == player_two.key()) || (game_queue_account_two.current_player == game_account.key()),
        constraint = (game_queue_account_two.last_player == player_two.key()) || (game_queue_account_two.last_player == game_account.key()),
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = (game_queue_account_three.current_player == player_three.key()) || (game_queue_account_three.current_player == game_account.key()),
        constraint = (game_queue_account_three.last_player == player_three.key()) || (game_queue_account_three.last_player == game_account.key()),
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 3,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to finish (destroy queues) of a king of the hill 3 player game.
pub struct FinishThreePlayerKingOfHillQueue<'info> {
    #[account(mut, close = game_account)]
    pub losing_player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_two: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 3,
        constraint = game_account.game_type == 1,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to initialize the queues of a 4 player game.
pub struct InitFourPlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(init, payer = payer, space = 8 + GameQueue::MAX_SIZE)]
    pub game_queue_account_four: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = (game_account.game_queues.get(0) == None) || ((*game_account.game_queues.get(0).unwrap()) == game_account.key()),
        constraint = (game_account.game_queues.get(1) == None) || ((*game_account.game_queues.get(1).unwrap()) == game_account.key()),
        constraint = (game_account.game_queues.get(2) == None) || ((*game_account.game_queues.get(2).unwrap()) == game_account.key()),
        constraint = (game_account.game_queues.get(3) == None) || ((*game_account.game_queues.get(3).unwrap()) == game_account.key())
    )]
    pub game_account: Box<Account<'info, Game>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to join a normal 4 player game's queues.
pub struct JoinFourPlayerGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(mut, constraint = q1_last_player.next_player == None)]
    pub q1_last_player: Account<'info, Player>,
    #[account(mut, constraint = q2_last_player.next_player == None)]
    pub q2_last_player: Account<'info, Player>,
    #[account(mut, constraint = q3_last_player.next_player == None)]
    pub q3_last_player: Account<'info, Player>,
    #[account(mut, constraint = q4_last_player.next_player == None)]
    pub q4_last_player: Account<'info, Player>,
    #[account(mut, constraint = game_queue_account_one.last_player == q1_last_player.key())]
    pub game_queue_account_one: Box<Account<'info, GameQueue>>,
    #[account(mut)]
    pub game_queue_account_two: Box<Account<'info, GameQueue>>,
    #[account(mut)]
    pub game_queue_account_three: Box<Account<'info, GameQueue>>,
    #[account(mut)]
    pub game_queue_account_four: Box<Account<'info, GameQueue>>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key(),
        constraint = (*game_account.game_queues.get(3).unwrap()) == game_queue_account_four.key(),
    )]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a normal 4 player game queue.
pub struct AdvanceFourPlayerGameQueue<'info> {
    #[account(mut, close = game_account)]
    pub player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub player_two: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub player_three: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub player_four: Box<Account<'info, Player>>,
    #[account(
        mut,
        constraint = game_queue_account_one.current_player == player_one.key(),
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.current_player == player_two.key(),
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_three.current_player == player_three.key(),
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_four.current_player == player_four.key(),
        constraint = game_queue_account_four.game == game_account.key()
    )]
    pub game_queue_account_four: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key(),
        constraint = (*game_account.game_queues.get(3).unwrap()) == game_queue_account_four.key(),
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a king of the hill 4 player game's queues.
pub struct AdvanceFourPlayerKingOfHillQueue<'info> {
    #[account(mut)]
    pub winning_player: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_two: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_three: Box<Account<'info, Player>>,
    #[account(
        mut,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_four.game == game_account.key()
    )]
    pub game_queue_account_four: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = game_account.game_type == 1,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key(),
        constraint = (*game_account.game_queues.get(3).unwrap()) == game_queue_account_four.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to advance a team king of the hill game's queues.
pub struct AdvanceTeamKingOfHillQueue<'info> {
    #[account(mut)]
    pub winning_player_one: Box<Account<'info, Player>>,
    #[account(mut)]
    pub winning_player_two: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_two: Box<Account<'info, Player>>,
    #[account(
        mut,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_four.game == game_account.key()
    )]
    pub game_queue_account_four: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = game_account.game_type == 2,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key(),
        constraint = (*game_account.game_queues.get(3).unwrap()) == game_queue_account_four.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context to finish (destroy queues) a 4 player game.
pub struct FinishFourPlayerGameQueue<'info> {
    #[account(
        mut,
        close = game_account,
        constraint = player_one.next_player == None
    )]
    pub player_one: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = player_two.next_player == None
    )]
    pub player_two: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = player_three.next_player == None
    )]
    pub player_three: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = player_four.next_player == None
    )]
    pub player_four: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_one.current_player == player_one.key(),
        constraint = game_queue_account_one.last_player == player_one.key(),
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = (game_queue_account_two.current_player == player_two.key()) || (game_queue_account_two.current_player == game_account.key()),
        constraint = (game_queue_account_two.last_player == player_two.key()) || (game_queue_account_two.last_player == game_account.key()),
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = (game_queue_account_three.current_player == player_three.key()) || (game_queue_account_three.current_player == game_account.key()),
        constraint = (game_queue_account_three.last_player == player_three.key()) || (game_queue_account_three.last_player == game_account.key()),
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = (game_queue_account_four.current_player == player_four.key()) || (game_queue_account_four.current_player == game_account.key()),
        constraint = (game_queue_account_four.last_player == player_four.key()) || (game_queue_account_four.last_player == game_account.key()),
        constraint = game_queue_account_four.game == game_account.key()
    )]
    pub game_queue_account_four: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = game_account.game_type == 0,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key(),
        constraint = (*game_account.game_queues.get(3).unwrap()) == game_queue_account_four.key(),
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context to finish (destroy queues) for a 4 player king of the hill game.
pub struct FinishFourPlayerKingOfHillQueue<'info> {
    #[account(mut, close = game_account)]
    pub losing_player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_two: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_three: Box<Account<'info, Player>>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        close = game_account,
        constraint = game_queue_account_four.game == game_account.key()
    )]
    pub game_queue_account_four: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = game_account.game_type == 1,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key(),
        constraint = (*game_account.game_queues.get(3).unwrap()) == game_queue_account_four.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to finish (destroy queues) for a 4 player team king of the hill game.
pub struct FinishTeamKingOfHillQueue<'info> {
    #[account(mut, close = game_account)]
    pub losing_player_one: Box<Account<'info, Player>>,
    #[account(mut, close = game_account)]
    pub losing_player_two: Box<Account<'info, Player>>,
    #[account(
        mut,
        constraint = game_queue_account_one.game == game_account.key()
    )]
    pub game_queue_account_one: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_two.game == game_account.key()
    )]
    pub game_queue_account_two: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_three.game == game_account.key()
    )]
    pub game_queue_account_three: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_queue_account_four.game == game_account.key()
    )]
    pub game_queue_account_four: Account<'info, GameQueue>,
    #[account(
        mut,
        constraint = game_account.max_players == 4,
        constraint = game_account.game_type == 2,
        constraint = (*game_account.game_queues.get(0).unwrap()) == game_queue_account_one.key(),
        constraint = (*game_account.game_queues.get(1).unwrap()) == game_queue_account_two.key(),
        constraint = (*game_account.game_queues.get(2).unwrap()) == game_queue_account_three.key(),
        constraint = (*game_account.game_queues.get(3).unwrap()) == game_queue_account_four.key()
    )]
    pub game_account: Account<'info, Game>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to join a king of the hill style game.
pub struct JoinKingOfHillGameQueue<'info> {
    #[account(init, payer = payer, space = 8 + Player::MAX_SIZE)]
    pub player_account: Account<'info, Player>,
    #[account(mut, constraint = last_player.next_player == None)]
    pub last_player: Account<'info, Player>,
    #[account(mut, constraint = (game_queue_account.last_player == last_player.key()) || (game_queue_account.last_player == game_account.key()))]
    pub game_queue_account: Account<'info, GameQueue>,
    #[account(mut, constraint = (game_account.game_type == 1) || (game_account.game_type == 2))]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to begin the payback of a games funds to the owner and winners
pub struct PaybackGameFunds<'info> {
    #[account(init, payer = owner, space = 8 + GamePot::MAX_SIZE)]
    pub player_one_pot: Account<'info, GamePot>,
    #[account(init, payer = owner, space = 8 + GamePot::MAX_SIZE)]
    pub player_two_pot: Account<'info, GamePot>,
    #[account(init, payer = owner, space = 8 + GamePot::MAX_SIZE)]
    pub player_three_pot: Account<'info, GamePot>,
    #[account(mut, constraint = game_account.owner_wallet == owner.key())]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub arcade_account: Account<'info, ArcadeState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to cash out a game pot to the respective winning player
pub struct CashOutPot<'info> {
    #[account(
        mut,
        close = winner,
        constraint = game_pot_account.winner_wallet == winner.key()
    )]
    pub game_pot_account: Account<'info, GamePot>,
    #[account(mut, constraint = previous_pot_account.next_game_pot.unwrap() == game_pot_account.key())]
    pub previous_pot_account: Account<'info, GamePot>,
    #[account(mut)]
    pub winner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to cash out a game pot to the respective winning player (game pot is the most recent pot)
pub struct CashOutMostRecentPot<'info> {
    #[account(
        mut,
        close = winner,
        constraint = game_pot_account.winner_wallet == winner.key()
    )]
    pub game_pot_account: Account<'info, GamePot>,
    #[account(mut, constraint = arcade_state.most_recent_game_pot_key.unwrap() == game_pot_account.key())]
    pub arcade_state: Account<'info, ArcadeState>,
    #[account(mut)]
    pub winner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
/// Context used to add funds to a game account (could be used for donations or preventing games from going under rent exemption)
pub struct RefillGameFunds<'info> {
    #[account(mut)]
    pub game_account: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
/// The ArcadeState is the account that points to the most current game uploaded to the arcade.
/// 
/// I will probably end up paying rent for this to make sure it never dissappears, but it should honestly be incredibly cheap because the rent-exempt
/// minimum for this size is currently 0.00133632, which is about $0.044232.
pub struct ArcadeState {
    pub most_recent_game_key: Pubkey, // the key of the most recent game to be added to the arcade.
    pub most_recent_game_pot_key: Option<Pubkey>, // the key of the most recent game pot
    pub authority: Pubkey, // the initializer of the arcade's key (aka my key).
}

impl ArcadeState {
    pub const MAX_SIZE: usize = mem::size_of::<Pubkey>() + mem::size_of::<Pubkey>() + mem::size_of::<Option<Pubkey>>();
}

#[account]
/// A game is the on-chain block that contains all important information about a game.
/// 
/// NOTE: All actual game data and game art will be stored on arweave to keep the gas prices down.  The only unintended consequence of this
/// is that games may not be modified after their upload, however we can delete a game if the person initializing the delete has the same
/// wallet public key as the owner_wallet.
/// 
/// Game Type:
/// 0 -> Normal
/// 1 -> King of the Hill
/// 2 -> Team King of the Hill
/// 3 -> 18+ Normal
/// 4 -> 18+ King of the Hill
/// 5 -> 18+ Team King of the Hill
pub struct Game {
    pub title: String,
    pub web_gl_hash: String,
    pub game_art_hash: String,
    pub max_players: u8,
    pub game_type: u8,
    pub strikes: u8,
    pub leaderboard: Leaderboard,
    pub game_queues: Vec<Pubkey>,
    pub younger_game_key: Pubkey,
    pub older_game_key: Pubkey,
    pub owner_wallet: Pubkey,
}

impl Game {
    pub const MAX_SIZE: usize = (30 * mem::size_of::<char>()) + // size of title
                                (2 * 256 * mem::size_of::<char>()) + // size of webgl hash and game art hash
                                (3 * mem::size_of::<u8>()) + // size of max players + game type
                                (Leaderboard::MAX_SIZE) + // size of leaderboard
                                (4 + 4 * mem::size_of::<Pubkey>()) + // size of game queues vector
                                (3 * mem::size_of::<Pubkey>()); // size of younger_game_key older_game_key and owner wallet
}

#[account]
/// The game queue is a game's player queue.  It seems that this would make the game too big, so it gets its own account.
/// 
/// size (GameQueue) = size(Pubkey) + 2 * size(Option<Pubkey>) = 32 + 66 = 98 Bytes
pub struct GameQueue {
    pub game: Pubkey,
    pub current_player: Pubkey,
    pub last_player: Pubkey,
    pub num_players_in_queue: u128,
}

impl GameQueue {
    pub const MAX_SIZE: usize = mem::size_of::<Pubkey>() + (2 * mem::size_of::<Pubkey>()) + mem::size_of::<u128>();
}

#[account]
/// The game pot is a struct created whenever a game is paying out where the funds for a player is stored.
/// 
/// size (GamePot) = 2 * size(Pubkey) + size(Option<Pubkey>) = 2 * 32 + 33 = 97 Bytes
pub struct GamePot {
    pub game: Pubkey,
    pub winner_wallet: Pubkey,
    pub next_game_pot: Option<Pubkey>
}

impl GamePot {
    pub const MAX_SIZE: usize = 2 * mem::size_of::<Pubkey>() + mem::size_of::<Option<Pubkey>>();
}

#[account]
/// The on chain reference for players to represent a player in a game's queue.
/// 
/// size(Player) = 1 * size(Pubkey) + 1 * size(Option<Pubkey>) = 32 + 33 = 65 Bytes
pub struct Player {
    pub wallet_key: Pubkey,
    pub next_player: Option<Pubkey>,
}

impl Player {
    pub const MAX_SIZE: usize = mem::size_of::<Pubkey>() + mem::size_of::<Option<Pubkey>>();
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
/// The Leaderboard organizes the different player's places by score.
/// size(Leaderboard) = 3 * size(Pace) = 3 * 60 = 180 Bytes
pub struct Leaderboard {
    pub first_place: Place, // The person in first place.
    pub second_place: Place, // The person in second place.
    pub third_place: Place, // The person in third place.
}

impl Leaderboard {
    pub const MAX_SIZE: usize = (3 * Place::MAX_SIZE);
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
/// A place is a player's place on the leaderboard.
/// size(Place) = 3*size(char) + size(Pubkey) + size(u128) = 3*4 + 32 + 16 = 12 + 32 + 16 = 60 Bytes
pub struct Place {
    pub name: String, // 3 character string for traditional arcade scoreboard names.
    pub wallet_key: Pubkey, // public key of the placeholder to allow the transfer of funds.
    pub score: u128, // High score achieved by this individual.
}

impl Place {
    pub const MAX_SIZE: usize = (3 * mem::size_of::<char>()) + (mem::size_of::<Pubkey>()) + (mem::size_of::<u128>());
}

#[event]
/// This is the event issues whenever a game is added or deleted from an arcade.
pub struct GameEvent {
    pub label: String, // label will be 'CREATE' and 'DELETE'.
    pub game_id: Pubkey, // created game.
    pub more_recent_game_id: Option<Pubkey>, // Useful for deleting games.
    pub less_recent_game_id: Option<Pubkey>, // Useful for creating games.
}

#[event]
/// This is the event issued whenever a leaderboard is updated
pub struct LeaderboardEvent {
    pub game_id: Pubkey, // the id of the game whose leaderboard is being updated.
    pub player_name: String, // player_name will be the 3 character name chosen by the player.
    pub first_place_name: String, // The 3 character name of the first place player.
    pub second_place_name: String, // The 3 character name of the second place player.
    pub third_place_name: String, // The 3 character name of the third place player.
}

#[event]
/// This is the event issued whenever a new queue is created (i.e. initialize queues is called).
pub struct NewQueueEvent {
    pub game_id: Pubkey,
    pub queue_ids: Vec<Pubkey>,
    pub queue_nums: Vec<u8>,
    pub new_player_ids: Vec<Option<Pubkey>>,
    pub num_players: Vec<u128>,
}

#[event]
/// This is the event issued whenever a player joins a game queue
pub struct JoinQueueEvent {
    pub game_id: Pubkey,
    pub queue_id: Pubkey,
    pub queue_num: u8,
    pub last_player: Pubkey,
    pub num_players: u128,
}

#[event]
/// This is the event issued whenever a game queue is advanced.
pub struct AdvanceQueueEvent {
    pub game_id: Pubkey,
    pub queue_ids: Vec<Pubkey>,
    pub queue_nums: Vec<u8>,
    pub finished_players: Vec<Option<Pubkey>>,
    pub new_players: Vec<Option<Pubkey>>,
    pub num_players: Vec<u128>,
}

#[event]
/// This is the event issued whenever a game queue is destroyed (i.e. when finishing a queue).
pub struct FinishQueueEvent {
    pub game_id: Pubkey,
}

#[event]
/// This is the event issued whenever a payout is issued for a game.
pub struct PayoutEvent {
    pub game_name: String,
    pub arcade_id: Pubkey,
    pub player_one_pot_key: Pubkey,
    pub player_two_pot_key: Pubkey,
    pub player_three_pot_key: Pubkey,
    pub player_one_name: String,
    pub player_two_name: String,
    pub player_three_name: String,
}

#[error_code]
pub enum Errors {
    #[msg("You cannot delete another user's games.  SHAME ON YOU")]
    CannotDeleteUnownedGame,

    #[msg("You cannot have a name that is more than 3 characters - or 0 characters")]
    IllegalName,

    #[msg("If you are going to delete a game, make sure to specify the correct game before and after it")]
    GameAccountNotProvidedToDelete,

    #[msg("You cannot create a game queue for a game that already has a game queue")]
    AlreadyInitializedGameQueue,

    #[msg("You cannot join an empty game queue if it is not empty")]
    GameQueueNotEmpty,

    #[msg("The game queue given does not exist in the game queues")]
    GameQueueDoesNotExist,

    #[msg("Cannot advance game queue with incorrect players provided")]
    CannotAdvanceGameQueueIncorrectPlayers,

    #[msg("Unknown team queue organization please restructure and try again")]
    UnknownTeamQueueOrganization,

    #[msg("Unknown game key, this is probably the wrong game queue to advance for this game")]
    CannotAdvanceGameQueueIncorrectGameKey,

    #[msg("Cannot advance a game queue with different number of players with this method")]
    CannotAdvanceGameQueueWrongMaxPlayers,

    #[msg("Cannot advance a game queue with different type using this method")]
    CannotAdvanceGameQueueWrongGameType,

    #[msg("Cannot advance a game queue with different game queues")]
    CannotAdvanceGameQueueWrongGameQueue,

    #[msg("TEST ERROR")]
    TestError,

    #[msg("Unable to get rent exempt amount")]
    CannotGetRentExemptAmount,

    #[msg("Insufficient funds to payout")]
    InsufficientFundsForPayout,

    #[msg("Insufficient funds to payout to pot 1")]
    InsufficientFundsPotOne,

    #[msg("Insufficient funds to payout to pot 2")]
    InsufficientFundsPotTwo,

    #[msg("Insufficient funds to payout to pot 3")]
    InsufficientFundsPotThree,
}