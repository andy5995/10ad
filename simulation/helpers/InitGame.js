/**
 * Called when the map has been loaded, but before the simulation has started.
 * Only called when a new game is started, not when loading a saved game.
 */
function PreInitGame()
{
	// We need to replace skirmish "default" entities with real ones.
	// This needs to happen before AI initialization (in InitGame).
	// And we need to flush destroyed entities otherwise the AI gets the wrong game state in
	// the beginning and a bunch of "destroy" messages on turn 0, which just shouldn't happen.
	Engine.BroadcastMessage(MT_SkirmishReplace, {});
	Engine.FlushDestroyedEntities();

	let numPlayers = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager).GetNumPlayers();
	for (let i = 1; i < numPlayers; ++i) // ignore gaia
	{
		let cmpTechnologyManager = QueryPlayerIDInterface(i, IID_TechnologyManager);
		if (cmpTechnologyManager)
			cmpTechnologyManager.UpdateAutoResearch();

		cmpTechnologyManager.UpdateAutoResearch();

		const civ = QueryPlayerIDInterface(i, IID_Identity).GetCiv();
		let cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);

		// The upgrades from all these will be researched
		const structure = ["storehouse", "farmstead", "house"];
		let research10adTechs = [];

		for (let s = 0; s < structure.length; s++)
			research10adTechs.push(...cmpTemplateManager.GetTemplateWithoutValidation("structures/" + civ + "/" + structure[s]).Researcher.Technologies._string.split(" "));

		for (let tech of research10adTechs)
		{
			const template = TechnologyTemplates.Get(tech);

			// Some civs do not get the same upgrades. Requirements are specified
			// in the templates
			let tReq = template.requirements.all;
			let tAny = [];

			if (tReq) {
				if (tReq.some(r => {
					if (r.any)
						tAny = r.any
					if (r.civ)
						return r.civ != civ;
					return r.notciv === civ;
				})) continue;
				if (tAny) {
					if (tAny.some(r => {
						return r.civ != civ;
					})) continue;
				}
			}
			cmpTechnologyManager.ResearchTechnology(tech);
		}
	}

	// Explore the map inside the players' territory borders
	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	cmpRangeManager.ExploreTerritories();
}

function InitGame(settings)
{
	// No settings when loading a map in Atlas, so do nothing
	if (!settings)
	{
		// Map dependent initialisations of components (i.e. garrisoned units)
		Engine.BroadcastMessage(MT_InitGame, {});
		return;
	}

	if (settings.ExploreMap)
	{
		let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
		for (let i = 1; i < settings.PlayerData.length; ++i)
			cmpRangeManager.ExploreMap(i);
	}

	const cmpAIManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_AIManager);
	for (let i = 0; i < settings.PlayerData.length; ++i)
	{
		const cmpPlayer = QueryPlayerIDInterface(i);
		cmpPlayer.SetCheatsEnabled(!!settings.CheatsEnabled);

		if (settings.PlayerData[i] && !!settings.PlayerData[i].AI)
		{
			cmpAIManager.AddPlayer(settings.PlayerData[i].AI, i, +settings.PlayerData[i].AIDiff, settings.PlayerData[i].AIBehavior || "random");
			cmpPlayer.SetAI(true);
		}

		if (settings.PopulationCap)
			cmpPlayer.SetMaxPopulation(settings.PopulationCap);

		if (settings.AllyView)
			Engine.QueryInterface(cmpPlayer.entity, IID_TechnologyManager)?.ResearchTechnology(Engine.QueryInterface(cmpPlayer.entity, IID_Diplomacy).template.SharedLosTech);
	}
	if (settings.WorldPopulationCap)
		Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager).SetMaxWorldPopulation(settings.WorldPopulationCap);

	// Update the grid with all entities created for the map init.
	Engine.QueryInterface(SYSTEM_ENTITY, IID_Pathfinder).UpdateGrid();

	// Map or player data (handicap...) dependent initialisations of components (i.e. garrisoned units).
	Engine.BroadcastMessage(MT_InitGame, {});

	cmpAIManager.TryLoadSharedComponent();
	cmpAIManager.RunGamestateInit();
}

Engine.RegisterGlobal("PreInitGame", PreInitGame);
Engine.RegisterGlobal("InitGame", InitGame);
