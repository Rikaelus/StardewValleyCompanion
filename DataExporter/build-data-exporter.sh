#!/bin/bash

# Build script for SMAPI Data Exporter mod

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# GAME_DIR should be set as an environment variable or passed as an argument
# Example: export STARDEW_GAME_DIR="/path/to/Stardew Valley"
# Or: ./build-data-exporter.sh "/path/to/Stardew Valley"
GAME_DIR="${1:-${STARDEW_GAME_DIR}}"

if [ -z "$GAME_DIR" ]; then
  echo "Error: Game directory not specified."
  echo "Usage: $0 \"/path/to/Stardew Valley\""
  echo "   Or: export STARDEW_GAME_DIR=\"/path/to/Stardew Valley\""
  exit 1
fi

MOD_NAME="DataExporter"
OUTPUT_DIR="$GAME_DIR/Mods/$MOD_NAME"

echo "Building Data Exporter mod..."
echo "Game directory: $GAME_DIR"

# Create temp build directory
TEMP_DIR="/tmp/DataExporter-build"
mkdir -p "$TEMP_DIR"

# Copy source files (using relative paths from script directory)
cp "$SCRIPT_DIR/DataExporter-ModEntry.cs" "$TEMP_DIR/ModEntry.cs"
cp "$SCRIPT_DIR/DataExporter-manifest.json" "$TEMP_DIR/manifest.json"

# Create csproj file
cat > "$TEMP_DIR/DataExporter.csproj" << 'EOF'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <AssemblyName>DataExporter</AssemblyName>
    <TargetFramework>net6.0</TargetFramework>
    <EnableHarmony>true</EnableHarmony>
  </PropertyGroup>

  <ItemGroup>
    <Reference Include="StardewModdingAPI">
      <HintPath>$(GamePath)/StardewModdingAPI.dll</HintPath>
      <Private>False</Private>
    </Reference>
    <Reference Include="Stardew Valley">
      <HintPath>$(GamePath)/Stardew Valley.dll</HintPath>
      <Private>False</Private>
    </Reference>
    <Reference Include="StardewValley.GameData">
      <HintPath>$(GamePath)/StardewValley.GameData.dll</HintPath>
      <Private>False</Private>
    </Reference>
    <Reference Include="Newtonsoft.Json">
      <HintPath>$(GamePath)/smapi-internal/Newtonsoft.Json.dll</HintPath>
      <Private>False</Private>
    </Reference>
  </ItemGroup>
</Project>
EOF

# Build the mod
cd "$TEMP_DIR"

# Use DOTNET_PATH if set, otherwise try common locations
DOTNET="${DOTNET_PATH:-dotnet}"
if ! command -v "$DOTNET" &> /dev/null; then
  # Try common install locations
  if [ -x "$HOME/.dotnet/dotnet" ]; then
    DOTNET="$HOME/.dotnet/dotnet"
  elif [ -x "/usr/local/share/dotnet/dotnet" ]; then
    DOTNET="/usr/local/share/dotnet/dotnet"
  else
    echo "Error: dotnet not found. Please install .NET SDK or set DOTNET_PATH."
    exit 1
  fi
fi

echo "Using .NET: $DOTNET"
"$DOTNET" build -c Release -p:GamePath="$GAME_DIR"

# Create mod directory
mkdir -p "$OUTPUT_DIR"

# Copy files
cp "$TEMP_DIR/bin/Release/net6.0/DataExporter.dll" "$OUTPUT_DIR/"
cp "$TEMP_DIR/manifest.json" "$OUTPUT_DIR/"

echo "Mod installed to: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Launch Stardew Valley"
echo "2. Load any save file"
echo "3. Check $OUTPUT_DIR/exported/ for JSON files"
echo "4. Copy the exported files to your project"
