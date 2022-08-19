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

	const cmpPlayerManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager);
  if (!cmpPlayerManager)
		return;

	let numPlayers = cmpPlayerManager.GetNumPlayers();
	for (let i = 1; i < numPlayers; ++i) // ignore gaia
	{
		let cmpTechnologyManager = QueryPlayerIDInterface(i, IID_TechnologyManager);
		if (!cmpTechnologyManager)
			continue;

		cmpTechnologyManager.UpdateAutoResearch();

		const civ = QueryPlayerIDInterface(i, IID_Identity).GetCiv();
		let cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
		let research10adTechs = cmpTemplateManager.GetTemplateWithoutValidation("structures/" + civ + "/storehouse").Researcher.Technologies._string.split(" ");
		research10adTechs.push.apply(research10adTechs, cmpTemplateManager.GetTemplateWithoutValidation("structures/" + civ + "/farmstead").Researcher.Technologies._string.split(" "));

		for (let tech of research10adTechs)
		{
			const template = TechnologyTemplates.Get(tech);
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

	// Sandbox, Very Easy, Easy, Medium, Hard, Very Hard
	// rate apply on resource stockpiling as gathering and trading
	// time apply on building, upgrading, packing, training and technologies
	let rate = [ 0.42, 0.56, 0.75, 1.00, 1.25, 1.56 ];
	let time = [ 1.40, 1.25, 1.10, 1.00, 1.00, 1.00 ];
	let cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	let cmpAIManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_AIManager);
	for (let i = 0; i < settings.PlayerData.length; ++i)
	{
		let cmpPlayer = QueryPlayerIDInterface(i);
		cmpPlayer.SetCheatsEnabled(!!settings.CheatsEnabled);

		if (settings.PlayerData[i] && !!settings.PlayerData[i].AI)
		{
			let AIDiff = +settings.PlayerData[i].AIDiff;
			cmpAIManager.AddPlayer(settings.PlayerData[i].AI, i, AIDiff, settings.PlayerData[i].AIBehavior || "random");
			cmpPlayer.SetAI(true);
			AIDiff = Math.min(AIDiff, rate.length - 1);
			cmpModifiersManager.AddModifiers("AI Bonus", {
				"ResourceGatherer/BaseSpeed": [{ "affects": ["Unit", "Structure"], "multiply": rate[AIDiff] }],
				"Trader/GainMultiplier": [{ "affects": ["Unit", "Structure"], "multiply": rate[AIDiff] }],
				"Cost/BuildTime": [{ "affects": ["Unit", "Structure"], "multiply": time[AIDiff] }],
			}, cmpPlayer.entity);
		}

		if (settings.PopulationCap)
			cmpPlayer.SetMaxPopulation(settings.PopulationCap);

		if (settings.AllyView)
			Engine.QueryInterface(cmpPlayer.entity, IID_TechnologyManager)?.ResearchTechnology(cmpPlayer.template.SharedLosTech);
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
