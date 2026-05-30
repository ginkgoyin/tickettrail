# DATA_SOURCES

## 1. Airport Data Source

- Global airport coverage is generated from [OurAirports](https://ourairports.com/data/).
- Preferred upstream file: `airports.csv`
- Current upstream download location is documented by OurAirports and mirrored from the maintained `davidmegginson/ourairports-data` repository.

## 2. Airport Filtering Rules

The airport generator keeps only ticket-useful airports:

- include `large_airport`
- include `medium_airport`
- include `small_airport` only when an IATA code exists

The generator excludes:

- closed airports
- heliports
- seaplane bases
- balloonports
- any record without an IATA code

If multiple rows share the same IATA code, the generator keeps the best candidate by preferring:

1. `large_airport`
2. `medium_airport`
3. `small_airport`
4. scheduled-service rows over non-scheduled rows

## 3. Generated Output

- Generator script: [C:\yx\00app\ticket\scripts\generate-airports-data.mjs](C:/yx/00app/ticket/scripts/generate-airports-data.mjs)
- Generated output: [C:\yx\00app\ticket\src\data\airports.generated.json](C:/yx/00app/ticket/src/data/airports.generated.json)

The generated airport records are normalized to the app's `LocationDirectoryEntry`-compatible shape:

- `id`
- `locationType = "airport"`
- `code` (IATA)
- `nameEn`
- `aliases`
- `latitude`
- `longitude`
- `countryCode`

OurAirports `airports.csv` does not provide app-ready Chinese names or timezones, so those are supplemented separately where needed.

## 4. Chinese Alias Overlay

- Overlay file: [C:\yx\00app\ticket\src\data\airport-aliases.zh-CN.ts](C:/yx/00app/ticket/src/data/airport-aliases.zh-CN.ts)

This curated overlay supplements the generated global airport list with:

- Chinese aliases for common China airports
- Chinese display names where available
- known timezone values for those curated airports

This overlay is additive only. It does not replace the global generated airport dataset.

## 5. Regeneration

1. Download `airports.csv` from the OurAirports data source.
2. Run:

```powershell
node scripts/generate-airports-data.mjs path\to\airports.csv
```

Optional explicit output path:

```powershell
node scripts/generate-airports-data.mjs path\to\airports.csv src\data\airports.generated.json
```

## 6. Station Data

- Train/rail station data remains separate from this airport pipeline.
- Global or nationwide station coverage is still a later task.
- See `DATA-002` for future train/rail station expansion work.
