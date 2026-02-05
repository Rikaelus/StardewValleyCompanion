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

                Monitor.Log("Starting data export...", LogLevel.Info);

                // Export all available game data assets
                var assetsToExport = new[]
                {
                    "Data/Objects",
                    "Data/BigCraftables",
                    "Data/Crops",
                    "Data/Fish",
                    "Data/FishPondData",
                    "Data/Locations",
                    "Data/NPCDispositions",
                    "Data/NPCGiftTastes",
                    "Data/Bundles",
                    "Data/Machines",
                    "Data/CookingRecipes",
                    "Data/CraftingRecipes",
                    "Data/Achievements",
                    "Data/Weapons",
                    "Data/Tools",
                    "Data/Buildings",
                    "Data/Movies",
                    "Data/Concessions",
                    "Data/Furniture",
                    "Data/Boots",
                    "Data/Hats",
                    "Data/Shirts",
                    "Data/Pants",
                    "Data/TailoringRecipes",
                    "Data/Monsters",
                    "Data/Quests",
                    "Data/SpecialOrders",
                    "Data/Events/Farm",
                    "Data/Events/Town",
                    "Data/FarmAnimals",
                    "Data/fruitTrees",
                    "Data/SecretNotes",
                    "Data/mail",
                    "Data/Festivals/spring13",
                    "Data/Festivals/spring24",
                    "Data/Festivals/summer11",
                    "Data/Festivals/summer28",
                    "Data/Festivals/fall16",
                    "Data/Festivals/fall27",
                    "Data/Festivals/winter8",
                    "Data/Festivals/winter25"
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

                // Generate filename from asset path
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
