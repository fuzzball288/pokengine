function character (name, team) {
	var self = this;

	self.name = name;
	self.gender = Genders.male;
	self.party = (arguments.length >= 2 ? team : new party());
	self.party.trainer = self;
	foreach(self.party.pokemon, function (poke) {
		poke.belong(self);
	});
	self.battlers = [];
	self.money = 0;
	self.nationality = Nationalities.British;
	self.bag = new bag();
	self.badges = [];
	
	self.give = function (poke) {
		poke.belong(self);
		self.party.add(poke);
	};
	self.release = function (poke) {
		self.party.release(poke);
	};

	self.pokemon = function () {
		return self.party.pokemon.length;
	};

	self.hasPokemon = function () {
		return self.pokemon() > 0;
	};

	self.healthyPokemon = function (thatAreNotBattling, excluding) {
		if (!self.hasPokemon())
			return [];
		var pokes = [];
		excluding = wrapArray(excluding);
		foreach(self.party.pokemon, function (poke) {
			if (poke.conscious() && (!thatAreNotBattling || !poke.battler.battling) && !excluding.contains(poke))
				pokes.push(poke);
		});
		return pokes;
	};

	self.hasHealthyPokemon = function (thatAreNotBattling, excluding) {
		return self.healthyPokemon(thatAreNotBattling, excluding).length > 0;
	};

	self.isAnNPC = function () {
		return Game.player !== self;
	};

	self.battlers = function () {
		var battlers = [];
		foreach(self.party.pokemon, function (poke) {
			if (poke.battler.battling)
				battlers.push(poke);
		});
		return battlers;
	};

	self.holdsControlOverPokemonUpToLevel = function () {
		var maximum = 0;
		foreach(self.badges, function (badge) {
			if (badge.obediance > maximum)
				maximum = badge.obediance;
		});
		return maximum;
	};
}