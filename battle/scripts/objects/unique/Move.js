Move = {
	category : {
		physical : q = 0,
		special : ++ q,
		status : ++ q,
		none : ++ q
	},
	target : {
		self : q = 0,
		directOpponent : ++ q,
		directTarget : ++ q,
		adjacentAlly : ++ q,
		adjacentOpponent : ++ q,
		farAlly : ++ q,
		farOpponent : ++ q
	},
	targets : {
		// Filled right after Move object declaration
	},
	action : {
		damage : q = 0,
		inflict : ++ q,
		status : ++ q,
		recoil : ++ q,
		weather : ++ q,
		trap : ++ q,
		fn : ++ q,
		message : ++ q
	},
	amount : {
		standard : q = 0,
		fixed : ++ q,
		percentage : ++ q,
		OHKO : ++ q
	},
	context : {
		user : {
			health : q = 0
		},
		target : {
		},
		move : {
			damage : q = 0
		}
	},
	Struggle : {
		number : -1,
		PP : Infinity,
		PPUps : 0
	},
	maximumPP : function (move, PPUps) {
		return Moves[move].PP * (1 + 0.2 * PPUps);
	},
	use : function (move, stage, mover, target, inception) {
		moveName = move;
		move = Moves._(move);
		if (target instanceof pokemon)
			target = Battle.placeOfPokemon(target);
		var constant = {},
			affectsEntireSide = (target === Battles.side.far || target === Battles.side.near),
			targetPokemon = (target !== NoPokemon && !affectsEntireSide ? Battle.pokemonInPlace(target) : NoPokemon),
			affected = (targetPokemon !== NoPokemon ? Battle.affectedByMove(mover, targetPokemon, move).filter(onlyPokemon) : []),
			completelyFailed = true,
			statedFailureReason = false,
			finalStage = (stage === move.effect.use.length - 1),
			animationEffect = null,
			stateEffect = null,
			modifiedMove = false;
		// If the move won't hit anything, try aiming for a different target
		if (!affectsEntireSide && stage === 0 && affected.empty()) {
			var newTarget = Battle.targetsForMove(mover, move, true);
			if (newTarget.notEmpty()) {
				target = newTarget[0].place;
				targetPokemon = newTarget[0].poke;
				affected = Battle.affectedByMove(mover, targetPokemon, move).filter(onlyPokemon);
			}
		}
		if (finalStage && moveName[0] !== "_") {
			if (affected.notEmpty() || affectsEntireSide)
				animationEffect = Textbox.state(mover.name() + " used " + moveName + (!affectsEntireSide && move.affects === Move.targets.directTarget && affected.notEmpty() ? " on " + (targetPokemon !== mover ? targetPokemon.name() : mover.selfPronoun()) : "") + "!", function () { return Move.animate(mover, move, stage, targetPokemon, constant); });
			else
				Textbox.state(mover.name() + " tried to use " + moveName + "...");
		} else
			animationEffect = Textbox.effect(function () { return Move.animate(mover, move, stage, targetPokemon, constant); });
		// Makes sure any Display states after the move has been used takes into consideration any movements by any of the Pokémon
		if (targetPokemon !== NoPokemon || affectsEntireSide) {
			Move.renderAnimation(mover, move, stage, targetPokemon, constant);
			var displayRendered = Display.state.save();
			stateEffect = Textbox.effect(function () { Display.state.load(displayRendered); });
		}
		if (move.effect.hasOwnProperty("constant") && (targetPokemon !== NoPokemon || affectsEntireSide)) {
			var constantData = move.effect.constant(mover, targetPokemon !== NoPokemon ? targetPokemon : target);
			if (typeof constantData === "object")
				constant = constantData;
		}
		if (!constant.hasOwnProperty("failed") || !constant.failed) {
			if (affected.notEmpty()) {
				var missEffect = false;
				foreach(affected, function (targeted) {
					var failed = false, accuracy, evasion;
					if (Battle.triggerEvent(Triggers.move, {
						move : move,
						affected : true
					}, mover, targeted).contains(true)) {
						failed = true;
						statedFailureReason = true;
					} else {
						if (!move.classification.contains("_")) {
							accuracy = (mover.battler.statLevel.accuracy === 0 ? 1 : mover.battler.statLevel.accuracy > 0 ? 1 + (1 / 3) * mover.battler.statLevel.accuracy : 3 / (Math.abs(mover.battler.statLevel.accuracy) + 3));
							evasion = (targeted.battler.statLevel.evasion === 0 ? 1 : targeted.battler.statLevel.evasion > 0 ? 1 + (1 / 3) * targeted.battler.statLevel.evasion : 3 / (Math.abs(targeted.battler.statLevel.evasion) + 3));
						} else {
							accuracy = 1;
							evasion = 1;
						}
						var hit = (!finalStage || (move.hasOwnProperty("accuracy") ? move.accuracy * (accuracy / evasion) >= srandom.point() : true));
						if (hit) {
							if (targeted.battler.protected && !move.piercing) {
								Textbox.state(targeted.name() + " protected " + targeted.selfPronoun() + ".");
								failed = true;
								statedFailureReason = true;
								missEffect = true;
							} else if (targeted.invulnerable && !move.despite.contains(targeted.invulnerable)) { // Dig, Fly, etc.
								Textbox.state(targeted.name() + " cannot be found!");
								failed = true;
								statedFailureReason = true;
								missEffect = true;
							} else {
								// Actually use the move
								var response = move.effect.use[stage](mover, targeted, constant);
								if (response) {
									if (response.hasOwnProperty("failed") && response.failed)
										failed = true;
									if (response.hasOwnProperty("reason")) {
										Textbox.state(response.reason);
										statedFailureReason = true;
									}
									if (response.hasOwnProperty("modifiedMove") && response.modifiedMove)
										modifiedMove = true;
								}
							}
						} else {
							if (accuracy <= evasion)
								Textbox.state(mover.name() + " missed " + targeted.name() + "!");
							else
								Textbox.state(targeted.name() + " evaded the attack!");
							failed = true;
							statedFailureReason = true;
							missEffect = true;
						}
					}
					if (missEffect && move.effect.hasOwnProperty("miss"))
						move.effect.miss(mover, targeted);
					if (failed) {
						if (move.effect.hasOwnProperty("fail"))
							move.effect.fail(mover, targeted);
						return {
							succeeded : false
						};
					} else
						completelyFailed = false;
				});
			} else if (affectsEntireSide) {
				var response = move.effect.use[stage](mover, target, constant), failed = false;
				if (response) {
					if (response.hasOwnProperty("failed") && response.failed)
						failed = true;
					if (response.hasOwnProperty("modifiedMove") && response.modifiedMove)
						modifiedMove = true;
				}
				if (failed) {
					if (move.effect.hasOwnProperty("fail"))
						move.effect.fail(mover, targeted);
					return {
						succeeded : false
					};
				} else
					completelyFailed = false;
			} else {
				Textbox.state("There was no target for " + mover.name() + " to hit...");
			}
		}
		if (completelyFailed) {
			if (!statedFailureReason)
				Textbox.state("But it failed!");
			if (animationEffect !== null)
				Textbox.removeEffects(animationEffect);
			if (stateEffect !== null) {
				Textbox.remove(stateEffect);
				battler.resetDisplay(mover);
				foreach(affected, function (targeted) {
					battler.resetDisplay(targeted);
				});
				displayRendered = Display.state.save();
				Textbox.effect(function () { Display.state.load(displayRendered); });
			}
		} else {
			Battle.survey();
		}
		return {
			succeeded : !completelyFailed,
			modifiedMove : modifiedMove
		};
	},
	renderAnimation : function (mover, move, stage, target, constant, track, last) {
		if (move.animation.length - 1 < stage || move.animation[stage].length === 0)
			return;
		var events = move.animation[stage].deepCopy(), from = Display.state.save();
		var affectsEntireSide = (target === Battles.side.far || target === Battles.side.near);
		foreach(events.sort(function (a, b) {
			if (a.hasOwnProperty("time"))
				aLast = a.time;
			else
				aLast = a.to;
			if (b.hasOwnProperty("time"))
				bLast = b.time;
			else
				bLast = b.to;
			return aLast - bLast;
		}), function (event) {
			if (event.hasOwnProperty("time")) {
				event.animation({
					display : mover.battler.display
				}, !affectsEntireSide ? {
					display : target.battler.display
				} : null, constant);
			} else {
				event.transition({
					display : mover.battler.display,
					from : Display.pokemonInState(mover, from).battler.display
				}, !affectsEntireSide ? {
					display : target.battler.display,
					from : Display.pokemonInState(target, from).battler.display
				} : null, 1, constant);
			}
		});
		View.reset();
	},
	animate : function (mover, move, stage, target, constant, track, last) {
		if (arguments.length < 6) {
			track = {
				completed : false,
				progress : 0
			};
			if (!Settings._("animated moves") || move.animation.length - 1 < stage || move.animation[stage].length === 0) {
				track.completed = true;
				return track;
			}
			last = 0; // The shortest length an animation can be (100 = 1 second)
		}
		var affectsEntireSide = (target === Battles.side.far || target === Battles.side.near);
		var start = move.animation[stage][track.progress].hasOwnProperty("time") ? move.animation[stage][track.progress].time : move.animation[stage][track.progress].from;
		if (arguments.length < 6 && start > 0) {
			setTimeout(function () { Move.animate(mover, move, stage, target, constant, track, last); }, Time.second * start / 100);
			return track;
		}
		if (move.animation[stage][track.progress].hasOwnProperty("time")) {
			last = Math.max(move.animation[stage][track.progress].time, last);
			move.animation[stage][track.progress].animation({
				display : Display.pokemonInState(mover).battler.display
			}, !affectsEntireSide ? {
				display : Display.pokemonInState(target).battler.display
			} : null, constant);
		} else {
			last = Math.max(move.animation[stage][track.progress].to, last);
			Move.transition(mover, move, stage, target, constant, track.progress, 0, Display.state.save(Display.state.current));
		}
		++ track.progress;
		var completed = (track.progress === move.animation[stage].length);
		if (completed) {
			setTimeout(function () { View.reset(); track.completed = true; }, Time.second * ((last - start) / 100));
		}
		else {
			var startOfNext = move.animation[stage][track.progress].hasOwnProperty("time") ? move.animation[stage][track.progress].time : move.animation[stage][track.progress].from;
			setTimeout(function () { Move.animate(mover, move, stage, target, constant, track, last); }, Time.second * (startOfNext - start) / 100);
		}
		return track;
	},
	transition : function (mover, move, stage, target, constant, start, progress, from) {
		var affectsEntireSide = (target === Battles.side.far || target === Battles.side.near);
		var duration = (move.animation[stage][start].to - move.animation[stage][start].from) / 100, frames = duration * Time.framerate;
		move.animation[stage][start].transition({
			display : Display.pokemonInState(mover).battler.display,
			from : Display.pokemonInState(mover, from).battler.display
		}, !affectsEntireSide ? {
			display : Display.pokemonInState(target).battler.display,
			from : Display.pokemonInState(target, from).battler.display
		} : null, Math.min(1, progress), constant);
		if (progress < 1)
			setTimeout(function () { Move.transition(mover, move, stage, target, constant, start, progress + 1 / frames, from); }, Time.refresh)
		else {
			View.reset();
		}
	},
	damage : function (attacker, target, move, power, type, noCritical) {
		move = Moves._(move);
		var weather = Battle.weather, multiTarget = (Battle.style === "double");
		power = power || move.power;
		if (arguments.length < 5)
			type = move.type;
		var modifiers = {
			critical : (srandom.chance(attacker.battler.statLevel.critical <= 0 ? 16 : attacker.battler.statLevel.critical === 1 ? 8 : attacker.battler.statLevel.critical === 2 ? 2 : 1) ? 1.5 : 1),
			multiTarget : (multiTarget ? 0.75 : 1),
			weather : ((Battle.weather === "intenseSunlight" && type === "Fire") || (Battle.weather === "rain" && type === "Water") ? 1.5 : (Battle.weather === "intenseSunlight" && type === "Water") || (Battle.weather === "rain" && type === "Fire") ? 0.5 : 1),
			sandstorm : (Battle.weather === "sandstorm" && target.ofType("Rock") ? 1.5 : 1),
			STAB : (attacker.ofType(type) ? 1.5 : 1),
			burn : (type === Move.category.physical && attacker.status === "burned" ? 0.5 : 1)
		};
		if (noCritical)
			modifiers.critical = 1;
		var min = (target.effectiveness(type, move.classification) > 0 ? 1 : 0);
		return {
			damage : Math.min(target.health, Math.max(1, Math.floor(Math.floor(Math.floor((Math.floor((2 * attacker.level * modifiers.critical) / 5 + 2) * power * (move.category === Move.category.physical ? attacker.stats.attack(true) : attacker.stats["special attack"](true))) / (move.category === Move.category.physical ? target.stats.defence(true) : target.stats["special defence"](true) * modifiers.sandstorm)) / 50 + 2) * modifiers.STAB * modifiers.weather * modifiers.multiTarget * modifiers.burn * target.effectiveness(type, move.classification) * (Math.floor(srandom.number(85, 100)) / 100)))),
			effectiveness : target.effectiveness(type, move.classification, attacker),
			critical : (modifiers.critical > 1),
			category : move.category,
			infiltrates : move.infiltrates || move.classification.contains("Sound"),
			cause : attacker,
			targets : move.targets
		};
	},
	exactDamage : function (attacker, target, move, damage, type) {
		if (arguments.length === 1)
			return {
				damage : arguments[0],
				effectiveness : 1,
				critical : false,
				category : Move.category.none,
				infiltrates : true,
				cause : NoPokemon,
				targets : Move.target.none
			};
		move = Moves._(move);
		if (arguments.length < 5)
			type = move.type;
		return {
			damage : damage,
			effectiveness : (target.effectiveness(type, move.classification) !== 0 ? 1 : 0),
			critical : false,
			category : move.category,
			infiltrates : move.infiltrates || move.classification.contains("Sound"),
			cause : attacker,
			targets : move.targets
		};
	},
	percentageDamage : function (poke, fraction) {
		return Move.exactDamage(Math.max(1, poke.stats.health() * fraction));
	},
	effectiveness : function (attacking, defending, flags) {
		var types = Types;
		if (arguments.length >= 3 && flags.contains("inverse"))
			types = InverseTypes;
		if (types[attacking].hasOwnProperty("strong") && types[attacking].strong.contains(defending))
			return 2;
		if (types[attacking].hasOwnProperty("weak") && types[attacking].weak.contains(defending))
			return 0.5;
		if (types[attacking].hasOwnProperty("ineffective") && types[attacking].ineffective.contains(defending))
			return 0;
		return 1;
	}
};
Move.targets = {
	// A preset list of all the common combinations of targets moves may use
	everyone : [Move.target.self, Move.target.directOpponent, Move.target.adjacentAlly, Move.target.adjacentOpponent, Move.target.farAlly, Move.target.farOpponent],
	allButUser : [Move.target.directOpponent, Move.target.adjacentAlly, Move.target.adjacentOpponent, Move.target.farAlly, Move.target.farOpponent],
	directOpponent : [Move.target.directOpponent],
	adjacentToUser : [Move.target.directOpponent, Move.target.adjacentAlly, Move.target.adjacentOpponent],
	opponents : [Move.target.directOpponent, Move.target.adjacentOpponent, Move.target.farOpponent],
	allies : [Move.target.self, Move.target.adjacentAlly, Move.target.farAlly],
	self : [Move.target.self],
	directTarget : [Move.target.directTarget],
	opponentAndAdjacent : [Move.target.directOpponent, Move.target.adjacentOpponent],
	selfAndAdjacent : [Move.target.self, Move.target.adjacentAlly],
	selfAndTarget : [Move.target.self, Move.target.directTarget],
	noone : [],
	closeBy : [Move.target.self, Move.target.directOpponent, Move.target.adjacentAlly, Move.target.adjacentOpponent],

	 // Special constants
	party : {},
	opposingSide : {},
	alliedSide : {}
};