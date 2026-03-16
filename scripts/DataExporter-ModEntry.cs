using System;
using System.IO;
using System.Collections.Generic;
using StardewModdingAPI;
using StardewModdingAPI.Events;
using Newtonsoft.Json;

namespace DataExporter
{
    public class ModEntry : Mod
    {
        public override void Entry(IModHelper helper)
        {
            helper.Events.GameLoop.SaveLoaded += OnSaveLoaded;
        }

        private void OnSaveLoaded(object sender, SaveLoadedEventArgs e)
        {
            try
            {
                string exportPath = Path.Combine(Helper.DirectoryPath, "exported");
                Directory.CreateDirectory(exportPath);

                Monitor.Log("Starting full data export...", LogLevel.Info);

                // All non-localized assets from Content/Data/
                var assetsToExport = new[]
                {
                    // Items & Equipment
                    "Data/Objects",
                    "Data/BigCraftables",
                    "Data/Crops",
                    "Data/Fish",
                    "Data/AquariumFish",
                    "Data/Furniture",
                    "Data/Boots",
                    "Data/hats",
                    "Data/Shirts",
                    "Data/Pants",
                    "Data/Weapons",
                    "Data/Tools",
                    "Data/Fences",
                    "Data/FloorsAndPaths",
                    "Data/AdditionalWallpaperFlooring",
                    "Data/WildTrees",
                    "Data/FruitTrees",
                    "Data/GiantCrops",
                    "Data/Trinkets",
                    "Data/Buffs",

                    // Shops & Economy
                    "Data/Shops",
                    "Data/GarbageCans",
                    "Data/LostItemsShop",

                    // Locations & World
                    "Data/Locations",
                    "Data/LocationContexts",
                    "Data/Minecarts",
                    "Data/WorldMap",
                    "Data/AdditionalFarms",

                    // NPCs & Characters
                    "Data/Characters",
                    // NPCDispositions removed — replaced by Data/Characters in 1.6
                    "Data/NPCGiftTastes",
                    "Data/Pets",
                    "Data/Mannequins",
                    "Data/HairData",
                    "Data/MakeoverOutfits",
                    "Data/PaintData",
                    "Data/HomeRenovations",
                    "Data/Weddings",
                    "Data/EngagementDialogue",
                    "Data/ExtraDialogue",

                    // Production & Processing
                    "Data/Machines",
                    "Data/FishPondData",
                    "Data/CookingRecipes",
                    "Data/CraftingRecipes",
                    "Data/TailoringRecipes",

                    // Quests & Progress
                    "Data/Bundles",
                    "Data/RandomBundles",
                    "Data/Quests",
                    "Data/SpecialOrders",
                    "Data/MonsterSlayerQuests",
                    "Data/Achievements",
                    "Data/MuseumRewards",
                    // IslandFieldOffice removed — doesn't exist as a data asset in 1.6
                    "Data/Powers",

                    // Buildings & Animals
                    "Data/Buildings",
                    "Data/FarmAnimals",

                    // Entertainment
                    "Data/Movies",
                    "Data/Concessions",
                    "Data/ConcessionTastes",
                    "Data/MoviesReactions",
                    "Data/JukeboxTracks",
                    "Data/TV/CookingChannel",
                    "Data/TV/TipChannel",
                    "Data/ChairTiles",

                    // Monsters & Combat
                    "Data/Monsters",

                    // Festivals & Events
                    "Data/PassiveFestivals",
                    "Data/Festivals/FestivalDates",
                    "Data/Festivals/spring13",
                    "Data/Festivals/spring24",
                    "Data/Festivals/summer11",
                    "Data/Festivals/summer28",
                    "Data/Festivals/fall16",
                    "Data/Festivals/fall27",
                    "Data/Festivals/winter8",
                    "Data/Festivals/winter25",

                    // Events (cutscenes by location)
                    "Data/Events/AbandonedJojaMart",
                    "Data/Events/AnimalShop",
                    "Data/Events/ArchaeologyHouse",
                    "Data/Events/Backwoods",
                    "Data/Events/BathHouse_Pool",
                    "Data/Events/Beach",
                    "Data/Events/BoatTunnel",
                    "Data/Events/BusStop",
                    "Data/Events/CommunityCenter",
                    "Data/Events/DesertFestival",
                    "Data/Events/ElliottHouse",
                    "Data/Events/Farm",
                    "Data/Events/FarmHouse",
                    "Data/Events/FishShop",
                    "Data/Events/Forest",
                    "Data/Events/HaleyHouse",
                    "Data/Events/HarveyRoom",
                    "Data/Events/Hospital",
                    "Data/Events/IslandFarmHouse",
                    // Data/Events/IslandFieldOffice removed — no .xnb exists in 1.6
                    "Data/Events/IslandHut",
                    "Data/Events/IslandNorth",
                    "Data/Events/IslandSouth",
                    "Data/Events/IslandWest",
                    "Data/Events/JoshHouse",
                    "Data/Events/LeahHouse",
                    "Data/Events/ManorHouse",
                    "Data/Events/Mine",
                    "Data/Events/Mountain",
                    "Data/Events/QiNutRoom",
                    "Data/Events/Railroad",
                    "Data/Events/Saloon",
                    "Data/Events/SamHouse",
                    "Data/Events/SandyHouse",
                    "Data/Events/ScienceHouse",
                    "Data/Events/SebastianRoom",
                    "Data/Events/SeedShop",
                    "Data/Events/Sewer",
                    "Data/Events/Sunroom",
                    "Data/Events/Temp",
                    "Data/Events/Tent",
                    "Data/Events/Town",
                    "Data/Events/Trailer",
                    "Data/Events/Trailer_Big",
                    "Data/Events/WizardHouse",
                    "Data/Events/Woods",

                    // Misc
                    "Data/TriggerActions",
                    "Data/SecretNotes",
                    "Data/mail",
                    "Data/animationDescriptions",
                    "Data/AudioChanges",
                    "Data/AdditionalLanguages",
                    "Data/IncomingPhoneCalls",

                    // Localized string tables (for resolving [LocalizedText ...] references)
                    "Strings/Furniture",
                    "Strings/Objects",
                    "Strings/BigCraftables",
                    "Strings/Buildings",
                    "Strings/Tools",
                    "Strings/Weapons",
                    "Strings/1_6_Strings",
                    "Strings/UI",
                    "Strings/Locations",
                    "Strings/Characters",
                    "Strings/NPCNames",
                    "Strings/FarmAnimals",
                    "Strings/BundleNames",
                    "Strings/EnchantmentNames",
                    "Strings/Events",
                    "Strings/Movies",
                    "Strings/MovieConcessions",
                    "Strings/MovieReactions",
                    "Strings/Quests",
                    "Strings/SpecialOrderStrings",
                    "Strings/StringsFromCSFiles",
                    "Strings/Notes",
                    "Strings/Shirts",
                    "Strings/Pants",
                    "Strings/WorldMap",
                    "Strings/Lexicon",
                    "Strings/SimpleNonVillagerDialogues",
                    "Strings/SpeechBubbles",
                    "Strings/StringsFromMaps",
                    "Strings/animationDescriptions",
                    "Strings/credits",

                    // Per-villager schedule strings
                    "Strings/schedules/Abigail",
                    "Strings/schedules/Alex",
                    "Strings/schedules/Caroline",
                    "Strings/schedules/Clint",
                    "Strings/schedules/Demetrius",
                    "Strings/schedules/Elliott",
                    "Strings/schedules/Emily",
                    "Strings/schedules/Evelyn",
                    "Strings/schedules/George",
                    "Strings/schedules/Gus",
                    "Strings/schedules/Haley",
                    "Strings/schedules/Harvey",
                    "Strings/schedules/Jas",
                    "Strings/schedules/Jodi",
                    "Strings/schedules/Leah",
                    "Strings/schedules/Leo",
                    "Strings/schedules/Lewis",
                    "Strings/schedules/Linus",
                    "Strings/schedules/Marnie",
                    "Strings/schedules/Maru",
                    "Strings/schedules/Pam",
                    "Strings/schedules/Penny",
                    "Strings/schedules/Pierre",
                    "Strings/schedules/Robin",
                    "Strings/schedules/Sam",
                    "Strings/schedules/Sandy",
                    "Strings/schedules/Sebastian",
                    "Strings/schedules/Shane",
                    "Strings/schedules/Vincent",
                    "Strings/schedules/Willy",
                };

                int successCount = 0;
                foreach (var assetPath in assetsToExport)
                {
                    if (ExportAsset(assetPath, exportPath))
                    {
                        successCount++;
                    }
                }

                Monitor.Log($"Data export complete! Exported {successCount}/{assetsToExport.Length} assets to {exportPath}", LogLevel.Info);
                Monitor.Log("You can now close the game and use the exported JSON files!", LogLevel.Alert);
            }
            catch (Exception ex)
            {
                Monitor.Log($"Error exporting data: {ex.Message}", LogLevel.Error);
                Monitor.Log($"Stack trace: {ex.StackTrace}", LogLevel.Error);
            }
        }

        private bool ExportAsset(string assetPath, string exportPath)
        {
            try
            {
                // Load the asset using SMAPI's content API
                var data = Helper.GameContent.Load<object>(assetPath);

                // Generate filename from asset path (Data/Events/Farm -> Events_Farm.json)
                string filename = assetPath.Replace("Data/", "").Replace("/", "_") + ".json";

                string json = JsonConvert.SerializeObject(data, Formatting.Indented);
                string filepath = Path.Combine(exportPath, filename);
                File.WriteAllText(filepath, json);

                Monitor.Log($"✓ Exported {filename}", LogLevel.Debug);
                return true;
            }
            catch (Exception ex)
            {
                Monitor.Log($"✗ Could not export {assetPath}: {ex.Message}", LogLevel.Warn);
                return false;
            }
        }
    }
}
