import SwiftUI
import SQLite3
import Network
import PhotosUI
import UIKit
import AVFoundation
import AVKit
import AuthenticationServices
import UniformTypeIdentifiers
import Security
import zlib

@main
struct KiokunApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .task {
                    await model.bootstrap()
                }
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var searchResults: [SearchResult] = []
    @Published var notes: [UserNote] = []
    @Published var studyCards: [StudyCard] = []
    @Published var customWords: [CustomWord] = []
    @Published var artifacts: [Artifact] = []
    @Published var syncTasks: [SyncTask] = []
    @Published var staticAssets: [StaticAssetSummary] = []
    @Published var statusMessage: String = "Loading offline database"
    @Published var selectedLanguage: LanguageFilter = .all
    @Published var isSyncing = false
    @Published private(set) var isOnline = false

    let network = NetworkStatus()
    @Published private(set) var db: LocalDatabase?
    private var syncEngine: SyncEngine?

    var shouldShowStatusToast: Bool {
        let normalized = statusMessage.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return false }
        return normalized.contains("failed") ||
            normalized.contains("error") ||
            normalized.contains("before syncing")
    }

    init() {
        network.onChange = { [weak self] isOnline in
            Task { @MainActor in
                self?.isOnline = isOnline
            }
        }
    }

    func bootstrap() async {
        do {
            let database = try LocalDatabase.openAppDatabase()
            try database.createSchema()
            try database.resetUserDataForUITestIfNeeded()
            try database.seedDevelopmentDataIfNeeded()
            try database.seedUITestDataIfNeeded()
            db = database
            syncEngine = SyncEngine(database: database)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Database error: \(error.localizedDescription)"
        }
    }

    func refreshAll() throws {
        guard let db else { return }
        notes = try db.listNotes()
        studyCards = try db.listStudyCards()
        customWords = try db.listCustomWords()
        artifacts = try db.listArtifacts()
        syncTasks = try db.listSyncTasks()
        staticAssets = try db.listStaticAssetSummaries()
    }

    func search(_ query: String) {
        guard let db else { return }
        do {
            var results = try db.search(query: query, language: selectedLanguage)
            if selectedLanguage == .all || selectedLanguage == .ja {
                for readingResult in try db.lookupReading(query: query, limit: 20) {
                    if let index = results.firstIndex(where: { $0.word == readingResult.word && $0.language == readingResult.language }) {
                        for definition in readingResult.definitions where !results[index].definitions.contains(definition) {
                            results[index].definitions.append(definition)
                        }
                    } else {
                        results.append(readingResult)
                    }
                }
            }
            searchResults = results
        } catch {
            statusMessage = "Search failed: \(error.localizedDescription)"
        }
    }

    func lookup(_ word: String) -> DictionaryRecord? {
        guard let db else { return nil }
        return try? db.lookup(word: word)
    }

    func lookupResolved(_ word: String) -> ResolvedDictionaryLookup? {
        guard let db else { return nil }
        return try? db.lookupResolved(word: word)
    }

    func inflectionAlternatives(_ word: String) -> [DictionaryInflectionMatch] {
        guard let db else { return [] }
        return (try? db.inflectionAlternatives(word: word)) ?? []
    }

    func saveNote(character: String, text: String) {
        guard let db else { return }
        do {
            try db.upsertNote(character: character, text: text)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Note save failed: \(error.localizedDescription)"
        }
    }

    func makeNoteImageMarkdown(character: String, data: Data) -> String? {
        guard let db else { return nil }
        do {
            let markdown = try db.storeNoteImage(character: character, imageData: data)
            statusMessage = ""
            return markdown
        } catch {
            statusMessage = "Note image save failed: \(error.localizedDescription)"
            return nil
        }
    }

    func deleteNote(_ note: UserNote) {
        guard let db else { return }
        do {
            try db.markNoteDeleted(id: note.id)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Delete failed: \(error.localizedDescription)"
        }
    }

    func notes(for keys: [String]) -> [EntryNote] {
        guard let db else { return [] }
        return ((try? db.listEntryNotes(keys: keys)) ?? []).map(EntryNote.init(localNote:))
    }

    func loadEntryNotes(keys: [String]) async -> [EntryNote] {
        guard !keys.isEmpty else { return [] }
        var merged = notes(for: keys)
        guard isOnline else { return EntryNote.uniqued(merged) }

        let client = CloudflareClient()
        guard client.baseURL != nil else { return EntryNote.uniqued(merged) }

        do {
            for key in keys {
                let remoteNotes = try await client.entryNotes(character: key).map(EntryNote.init(remoteNote:))
                merged.append(contentsOf: remoteNotes)
            }
        } catch {
            return EntryNote.uniqued(merged)
        }

        return EntryNote.uniqued(merged)
    }

    func addStudyCard(word: String, language: LanguageCode) {
        guard let db else { return }
        do {
            try db.addStudyCard(word: word, language: language)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Study save failed: \(error.localizedDescription)"
        }
    }

    func review(card: StudyCard, rating: ReviewRating) {
        guard let db else { return }
        do {
            try db.review(card: card, rating: rating)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Review failed: \(error.localizedDescription)"
        }
    }

    func reset(card: StudyCard) {
        guard let db else { return }
        do {
            try db.reset(card: card)
            try refreshAll()
        } catch {
            statusMessage = "Reset failed: \(error.localizedDescription)"
        }
    }

    func delete(card: StudyCard) {
        guard let db else { return }
        do {
            try db.deleteStudyCard(id: card.id)
            try refreshAll()
        } catch {
            statusMessage = "Card delete failed: \(error.localizedDescription)"
        }
    }

    func save(customWord: CustomWordDraft) {
        guard let db else { return }
        do {
            try db.upsertCustomWord(customWord)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Custom word save failed: \(error.localizedDescription)"
        }
    }

    func createArtifact(_ draft: ArtifactDraft) {
        guard let db else { return }
        do {
            try db.createArtifact(draft)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Artifact save failed: \(error.localizedDescription)"
        }
    }

    func addSentence(to artifact: Artifact, original: String, translation: String) {
        guard let db else { return }
        do {
            try db.addArtifactSentence(artifactId: artifact.id, original: original, translation: translation)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Sentence save failed: \(error.localizedDescription)"
        }
    }

    func addImage(to artifact: Artifact, data: Data) {
        guard let db else { return }
        do {
            try db.addArtifactImage(artifactId: artifact.id, imageData: data)
            try refreshAll()
            statusMessage = ""
        } catch {
            statusMessage = "Image save failed: \(error.localizedDescription)"
        }
    }

    func syncNow() async {
        guard let syncEngine else { return }
        isSyncing = true
        defer { isSyncing = false }
        do {
            try await syncEngine.processQueue()
            try refreshAll()
            statusMessage = "Sync complete"
        } catch {
            statusMessage = "Sync failed: \(error.localizedDescription)"
            try? refreshAll()
        }
    }

    var studyStats: StudyStats {
        StudyStats(cards: studyCards)
    }
}

final class NetworkStatus: ObservableObject, @unchecked Sendable {
    @Published var isOnline = false
    var onChange: ((Bool) -> Void)?
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "Kiokun.NetworkStatus")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                let isOnline = path.status == .satisfied
                self?.isOnline = isOnline
                self?.onChange?(isOnline)
            }
        }
        monitor.start(queue: queue)
    }
}

enum LanguageCode: String, Codable, CaseIterable, Identifiable {
    case zh
    case ja
    case ko

    var id: String { rawValue }

    var title: String {
        switch self {
        case .zh: "Chinese"
        case .ja: "Japanese"
        case .ko: "Korean"
        }
    }

    var searchLanguage: String {
        switch self {
        case .zh: "chinese"
        case .ja: "japanese"
        case .ko: "korean"
        }
    }

    var speechLocale: String {
        switch self {
        case .zh: "zh-CN"
        case .ja: "ja-JP"
        case .ko: "ko-KR"
        }
    }
}

enum LanguageFilter: String, CaseIterable, Identifiable {
    case all
    case zh
    case ja
    case ko

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "All"
        case .zh: "Chinese"
        case .ja: "Japanese"
        case .ko: "Korean"
        }
    }

    var code: LanguageCode? {
        switch self {
        case .all: nil
        case .zh: .zh
        case .ja: .ja
        case .ko: .ko
        }
    }
}

struct SearchResult: Identifiable, Hashable {
    var word: String
    var language: String
    var pronunciation: String
    var definitions: [String]
    var isCommon: Bool
    var resolvedWord: String? = nil
    var conjugationInfo: String? = nil
    var alternativeInflections: [DictionaryInflectionMatch] = []

    var id: String { "\(word)-\(language)-\(pronunciation)-\(resolvedWord ?? "")-\(conjugationInfo ?? "")-\(alternativeInflections.count)" }
}

struct JapaneseEntryHomophoneGroup: Identifiable, Hashable {
    var reading: String
    var words: [SearchResult]

    var id: String { reading }
}

enum JapaneseEntryHomophoneResolver {
    static func groups(
        for record: DictionaryRecord,
        currentWord: String,
        db: LocalDatabase,
        limit: Int = 20
    ) throws -> [JapaneseEntryHomophoneGroup] {
        let readings = readings(for: record)
        guard !readings.isEmpty else { return [] }

        let excluded = excludedLookupForms(for: record, currentWord: currentWord)
        var groups: [JapaneseEntryHomophoneGroup] = []
        for reading in readings {
            let words = try db.lookupReading(query: reading, limit: limit)
                .filter { result in
                    !excluded.contains(result.word) &&
                    !excluded.contains(LocalDatabase.kanaToHiragana(result.word))
                }
            if !words.isEmpty {
                groups.append(JapaneseEntryHomophoneGroup(reading: reading, words: words))
            }
        }
        return groups
    }

    static func readings(for record: DictionaryRecord) -> [String] {
        var values: [String] = []
        for entry in record.japaneseWordEntries {
            values.append(contentsOf: entry.visibleKana.map(\.text))
        }
        for section in record.japanese {
            values.append(contentsOf: splitLookupForms(section.reading))
        }
        return unique(values.map(LocalDatabase.kanaToHiragana))
    }

    static func excludedLookupForms(for record: DictionaryRecord, currentWord: String) -> Set<String> {
        var values = [record.key, currentWord]
        for entry in record.japaneseWordEntries {
            values.append(entry.displayHeadword)
            values.append(entry.displayReading)
            values.append(contentsOf: entry.visibleKanji.map(\.text))
            values.append(contentsOf: entry.visibleKana.map(\.text))
        }
        for section in record.japanese {
            values.append(section.headword)
            values.append(section.reading)
        }

        var output = Set<String>()
        for value in values.flatMap(splitLookupForms) {
            output.insert(value)
            output.insert(LocalDatabase.kanaToHiragana(value))
        }
        return output
    }

    private static func splitLookupForms(_ value: String) -> [String] {
        value
            .components(separatedBy: CharacterSet(charactersIn: "、/;，,\n\t"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func unique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var output: [String] = []
        for value in values.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !value.isEmpty {
            if seen.insert(value).inserted {
                output.append(value)
            }
        }
        return output
    }
}

enum HandwritingRecognitionLanguage: String, Codable, CaseIterable, Identifiable {
    case ja
    case zh

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ja: "Japanese"
        case .zh: "Chinese"
        }
    }

    init(filter: LanguageFilter) {
        self = filter == .zh ? .zh : .ja
    }
}

struct HandwritingStroke: Codable, Hashable {
    var x: [Double] = []
    var y: [Double] = []
    var t: [Double] = []

    var isEmpty: Bool {
        x.isEmpty || y.isEmpty || t.isEmpty
    }

    mutating func append(x nextX: Double, y nextY: Double, t nextT: Double) {
        x.append(nextX)
        y.append(nextY)
        t.append(nextT)
    }
}

private struct HandwritingRecognitionRequest: Encodable {
    var strokes: [HandwritingStroke]
    var language: String
}

private struct HandwritingRecognitionResponse: Decodable {
    var candidates: [String]
}

struct DictionaryRecord: Identifiable {
    var key: String
    var redirect: String?
    var chinese: [WordSection]
    var japanese: [WordSection]
    var korean: [WordSection]
    var chineseWordEntries: [ChineseWordEntry] = []
    var japaneseWordEntries: [JapaneseWordEntry] = []
    var koreanWordEntries: [KoreanWordEntry] = []
    var characters: [CharacterSummary]
    var japaneseNames: [JapaneseNameSummary]
    var contains: [EntryPreview]
    var containedInChinese: [EntryPreview]
    var containedInJapanese: [EntryPreview]
    var containedInKorean: [EntryPreview]
    var similarCharacters: [SimilarCharacter]
    var related: [String]
    var rawJSON: String
    var japaneseLabels: JapaneseLabelLookup = .empty

    var id: String { key }

    var allSections: [WordSection] {
        chinese + japanese + korean
    }
}

struct DictionaryInflectionMatch: Hashable {
    var original: String
    var dictionaryForm: String
    var conjugationInfo: String
}

struct ResolvedDictionaryLookup {
    var record: DictionaryRecord
    var inflection: DictionaryInflectionMatch?
}

struct JapaneseDeinflectionCandidate: Hashable {
    var word: String
    var conjugationInfo: String
    var depth: Int
    var expectedTypes: JapaneseWordType = .any
}

struct JapaneseWordType: OptionSet, Hashable {
    let rawValue: Int

    static let ichidan = JapaneseWordType(rawValue: 1 << 0)
    static let godan = JapaneseWordType(rawValue: 1 << 1)
    static let iAdjective = JapaneseWordType(rawValue: 1 << 2)
    static let kuru = JapaneseWordType(rawValue: 1 << 3)
    static let suru = JapaneseWordType(rawValue: 1 << 4)
    static let specialSuru = JapaneseWordType(rawValue: 1 << 5)
    static let nounSuru = JapaneseWordType(rawValue: 1 << 6)
    static let any: JapaneseWordType = [.ichidan, .godan, .iAdjective, .kuru, .suru, .specialSuru, .nounSuru]

    static func fromPartOfSpeechTags(_ tags: [String]) -> JapaneseWordType {
        var output: JapaneseWordType = []
        for tag in tags {
            let normalized = tag
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
                .replacingOccurrences(of: "_", with: "-")
            if normalized == "v1" || normalized == "v1-s" || normalized == "vz" {
                output.insert(.ichidan)
            }
            if normalized.hasPrefix("v5") || normalized.hasPrefix("v4") {
                output.insert(.godan)
            }
            if normalized == "adj-i" || normalized == "adj-ix" {
                output.insert(.iAdjective)
            }
            if normalized == "vk" {
                output.insert(.kuru)
            }
            if normalized == "vs" || normalized == "vs-i" {
                output.insert(.suru)
            }
            if normalized == "vs" {
                output.insert(.nounSuru)
            }
            if normalized == "vs-s" || normalized == "vs-c" {
                output.insert(.specialSuru)
            }
        }
        return output
    }

    func matches(record: DictionaryRecord) -> Bool {
        if self == .any || isEmpty {
            return true
        }

        var entryTypes: JapaneseWordType = []
        for section in record.japanese {
            entryTypes.formUnion(Self.fromPartOfSpeechTags(section.tags))
        }
        for entry in record.japaneseWordEntries {
            for sense in entry.senses {
                entryTypes.formUnion(Self.fromPartOfSpeechTags(sense.partOfSpeech))
            }
        }

        guard !entryTypes.isEmpty else { return false }
        return !intersection(entryTypes).isEmpty
    }
}

struct KoreanDeinflectionCandidate: Hashable {
    var word: String
    var conjugationInfo: String
    var depth: Int
}

enum JapaneseDeinflector {
    private static let romajiToHiraganaMap: [String: String] = [
        "a": "あ", "i": "い", "u": "う", "e": "え", "o": "お",
        "ka": "か", "ki": "き", "ku": "く", "ke": "け", "ko": "こ",
        "sa": "さ", "si": "し", "shi": "し", "su": "す", "se": "せ", "so": "そ",
        "ta": "た", "ti": "ち", "chi": "ち", "tu": "つ", "tsu": "つ", "te": "て", "to": "と",
        "na": "な", "ni": "に", "nu": "ぬ", "ne": "ね", "no": "の",
        "ha": "は", "hi": "ひ", "hu": "ふ", "fu": "ふ", "he": "へ", "ho": "ほ",
        "ma": "ま", "mi": "み", "mu": "む", "me": "め", "mo": "も",
        "ya": "や", "yu": "ゆ", "yo": "よ",
        "ra": "ら", "ri": "り", "ru": "る", "re": "れ", "ro": "ろ",
        "wa": "わ", "wo": "を", "n": "ん", "n'": "ん",
        "ga": "が", "gi": "ぎ", "gu": "ぐ", "ge": "げ", "go": "ご",
        "za": "ざ", "zi": "じ", "ji": "じ", "zu": "ず", "ze": "ぜ", "zo": "ぞ",
        "da": "だ", "di": "ぢ", "du": "づ", "de": "で", "do": "ど",
        "ba": "ば", "bi": "び", "bu": "ぶ", "be": "べ", "bo": "ぼ",
        "pa": "ぱ", "pi": "ぴ", "pu": "ぷ", "pe": "ぺ", "po": "ぽ",
        "kya": "きゃ", "kyu": "きゅ", "kyo": "きょ",
        "sha": "しゃ", "shu": "しゅ", "sho": "しょ", "sya": "しゃ", "syu": "しゅ", "syo": "しょ",
        "cha": "ちゃ", "chu": "ちゅ", "cho": "ちょ", "tya": "ちゃ", "tyu": "ちゅ", "tyo": "ちょ",
        "nya": "にゃ", "nyu": "にゅ", "nyo": "にょ",
        "hya": "ひゃ", "hyu": "ひゅ", "hyo": "ひょ",
        "mya": "みゃ", "myu": "みゅ", "myo": "みょ",
        "rya": "りゃ", "ryu": "りゅ", "ryo": "りょ",
        "gya": "ぎゃ", "gyu": "ぎゅ", "gyo": "ぎょ",
        "ja": "じゃ", "ju": "じゅ", "jo": "じょ", "jya": "じゃ", "jyu": "じゅ", "jyo": "じょ",
        "bya": "びゃ", "byu": "びゅ", "byo": "びょ",
        "pya": "ぴゃ", "pyu": "ぴゅ", "pyo": "ぴょ"
    ]

    static func candidates(for input: String, limit: Int = 48) -> [JapaneseDeinflectionCandidate] {
        let normalized = normalizeToHiragana(input.trimmingCharacters(in: .whitespacesAndNewlines))
        guard !normalized.isEmpty else { return [] }

        var seen = Set<String>()
        return deinflect(input)
            .filter { !$0.reasonChains.isEmpty }
            .map {
                JapaneseDeinflectionCandidate(
                    word: $0.word,
                    conjugationInfo: formatReasonChains($0.reasonChains),
                    depth: reasonCount($0.reasonChains),
                    expectedTypes: $0.type.japaneseWordTypes()
                )
            }
            .filter { !$0.conjugationInfo.isEmpty && seen.insert("\($0.word)|\($0.conjugationInfo)").inserted }
            .sorted {
                if $0.depth != $1.depth { return $0.depth < $1.depth }
                if $0.word.count != $1.word.count { return $0.word.count < $1.word.count }
                return $0.word < $1.word
            }
            .prefix(limit)
            .map { $0 }
    }

    private enum Reason: Hashable {
        case politePastNegative
        case politeNegative
        case politeVolitional
        case chau
        case sugiru
        case politePast
        case tara
        case tari
        case causative
        case potentialOrPassive
        case toku
        case sou
        case tai
        case polite
        case respectful
        case humble
        case humbleOrKansaiDialect
        case past
        case negative
        case passive
        case ba
        case volitional
        case potential
        case eruUru
        case causativePassive
        case te
        case zu
        case imperative
        case masuStem
        case adverbial
        case noun
        case imperativeNegative
        case continuous
        case ki
        case suruNoun
        case zaruWoEnai
        case negativeTe
        case irregular

        var label: String {
            switch self {
            case .politePastNegative: return "polite past negative"
            case .politeNegative: return "polite negative"
            case .politeVolitional: return "polite volitional"
            case .chau: return "-chau"
            case .sugiru: return "-sugiru"
            case .politePast: return "polite past"
            case .tara: return "-tara"
            case .tari: return "-tari"
            case .causative: return "causative"
            case .potentialOrPassive: return "potential or passive"
            case .toku: return "-te oku"
            case .sou: return "-sou"
            case .tai: return "-tai"
            case .polite: return "polite"
            case .respectful: return "respectful"
            case .humble: return "humble"
            case .humbleOrKansaiDialect: return "humble or Kansai dialect"
            case .past: return "past"
            case .negative: return "negative"
            case .passive: return "passive"
            case .ba: return "-ba"
            case .volitional: return "volitional"
            case .potential: return "potential"
            case .eruUru: return "-eru/-uru"
            case .causativePassive: return "causative passive"
            case .te: return "-te"
            case .zu: return "-zu"
            case .imperative: return "imperative"
            case .masuStem: return "masu stem"
            case .adverbial: return "adv"
            case .noun: return "noun"
            case .imperativeNegative: return "imperative negative"
            case .continuous: return "continuous"
            case .ki: return "-ki"
            case .suruNoun: return "-suru"
            case .zaruWoEnai: return "\"have no choice but to\""
            case .negativeTe: return "negative -te"
            case .irregular: return "irregular"
            }
        }
    }

    private struct RuleType: OptionSet, Hashable {
        let rawValue: Int

        static let ichidanVerb = RuleType(rawValue: 1 << 0)
        static let godanVerb = RuleType(rawValue: 1 << 1)
        static let iAdjective = RuleType(rawValue: 1 << 2)
        static let kuruVerb = RuleType(rawValue: 1 << 3)
        static let suruVerb = RuleType(rawValue: 1 << 4)
        static let specialSuruVerb = RuleType(rawValue: 1 << 5)
        static let nounSuru = RuleType(rawValue: 1 << 6)
        static let all: RuleType = [.ichidanVerb, .godanVerb, .iAdjective, .kuruVerb, .suruVerb, .specialSuruVerb, .nounSuru]
        static let initial = RuleType(rawValue: 1 << 7)
        static let taTeStem = RuleType(rawValue: 1 << 8)
        static let daDeStem = RuleType(rawValue: 1 << 9)
        static let masuStem = RuleType(rawValue: 1 << 10)
        static let irrealisStem = RuleType(rawValue: 1 << 11)
        static let initialCandidate: RuleType = [.all, .initial, .masuStem]

        func japaneseWordTypes() -> JapaneseWordType {
            var output: JapaneseWordType = []
            if contains(.ichidanVerb) { output.insert(.ichidan) }
            if contains(.godanVerb) { output.insert(.godan) }
            if contains(.iAdjective) { output.insert(.iAdjective) }
            if contains(.kuruVerb) { output.insert(.kuru) }
            if contains(.suruVerb) { output.insert(.suru) }
            if contains(.specialSuruVerb) { output.insert(.specialSuru) }
            if contains(.nounSuru) { output.insert(.nounSuru) }
            return output.isEmpty ? .any : output
        }
    }

    private struct Rule {
        var from: String
        var to: String
        var fromType: RuleType
        var toType: RuleType
        var reasons: [Reason]

        init(_ from: String, _ to: String, _ fromType: RuleType, _ toType: RuleType, _ reasons: [Reason]) {
            self.from = from
            self.to = to
            self.fromType = fromType
            self.toType = toType
            self.reasons = reasons
        }
    }

    private struct RuleGroup {
        var fromLength: Int
        var rules: [Rule]
    }

    private struct CandidateState {
        var word: String
        var type: RuleType
        var reasonChains: [[Reason]]
    }

    private static func deinflect(_ input: String) -> [CandidateState] {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = normalizeToHiragana(trimmed)
        guard !normalized.isEmpty else { return [] }

        var results = [CandidateState(word: normalized, type: .initialCandidate, reasonChains: [])]
        var resultIndex = [normalized: 0]

        if normalized != trimmed {
            results.append(CandidateState(word: trimmed, type: .initialCandidate, reasonChains: []))
            resultIndex[trimmed] = results.count - 1
        }

        func appendState(_ state: CandidateState) {
            guard !state.word.isEmpty else { return }
            if let existingIndex = resultIndex[state.word],
               results[existingIndex].type == state.type {
                for chain in state.reasonChains where !results[existingIndex].reasonChains.contains(chain) {
                    results[existingIndex].reasonChains.insert(chain, at: 0)
                }
                return
            }
            resultIndex[state.word] = results.count
            results.append(state)
        }

        var index = 0
        while index < results.count {
            let candidate = results[index]
            defer { index += 1 }

            if candidate.type.contains(.ichidanVerb),
               candidate.reasonChains.count == 1,
               candidate.reasonChains.first == [.masuStem] {
                continue
            }

            if !candidate.type.intersection([.masuStem, .taTeStem, .irrealisStem]).isEmpty {
                var forwardingReasons: [[Reason]] = []
                if candidate.type.contains(.masuStem), candidate.reasonChains.isEmpty {
                    forwardingReasons.append([.masuStem])
                }

                let firstReason = candidate.reasonChains.first?.first
                let isInapplicableIrrealis = candidate.type.contains(.irrealisStem)
                    && (firstReason == .passive || firstReason == .causative || firstReason == .causativePassive)

                if !isInapplicableIrrealis {
                    appendState(CandidateState(
                        word: candidate.word + "る",
                        type: [.ichidanVerb, .kuruVerb],
                        reasonChains: candidate.reasonChains + forwardingReasons
                    ))
                }
            }

            for group in ruleGroups where group.fromLength <= candidate.word.count {
                let ending = String(candidate.word.suffix(group.fromLength))
                let hiraganaEnding = kanaToHiragana(ending)

                for rule in group.rules {
                    guard !candidate.type.intersection(rule.fromType).isEmpty else { continue }
                    guard ending == rule.from || hiraganaEnding == rule.from else { continue }

                    let prefix = String(candidate.word.dropLast(rule.from.count))
                    let newWord = prefix + rule.to
                    guard !newWord.isEmpty else { continue }

                    if !rule.reasons.isEmpty {
                        let existingReasons = Set(candidate.reasonChains.flatMap { $0 })
                        if !existingReasons.isDisjoint(with: Set(rule.reasons)) {
                            continue
                        }
                    }

                    if let existingIndex = resultIndex[newWord],
                       results[existingIndex].type == rule.toType {
                        if !rule.reasons.isEmpty, !results[existingIndex].reasonChains.contains(rule.reasons) {
                            results[existingIndex].reasonChains.insert(rule.reasons, at: 0)
                        }
                        continue
                    }

                    var reasonChains = candidate.reasonChains
                    if !rule.reasons.isEmpty {
                        if !reasonChains.isEmpty {
                            var firstReasonChain = reasonChains[0]
                            if rule.reasons.first == .causative, firstReasonChain.first == .potentialOrPassive {
                                firstReasonChain.removeFirst()
                                firstReasonChain.insert(.causativePassive, at: 0)
                            } else if rule.reasons.first == .masuStem, !firstReasonChain.isEmpty {
                                // The web rule table suppresses redundant "masu stem" labels when another reason already exists.
                            } else {
                                firstReasonChain.insert(contentsOf: rule.reasons, at: 0)
                            }
                            reasonChains[0] = firstReasonChain
                        } else {
                            reasonChains.append(rule.reasons)
                        }
                    }

                    appendState(CandidateState(word: newWord, type: rule.toType, reasonChains: reasonChains))
                }
            }
        }

        return results.filter { !$0.type.intersection(.all).isEmpty }
    }

    private static func formatReasonChains(_ chains: [[Reason]]) -> String {
        if chains.isEmpty { return "" }
        return chains
            .map { $0.map(\.label).joined(separator: " → ") }
            .joined(separator: " or ")
    }

    private static func reasonCount(_ chains: [[Reason]]) -> Int {
        chains.reduce(0) { $0 + $1.count }
    }

    private static func normalizeToHiragana(_ text: String) -> String {
        if isRomaji(text) {
            return romajiToHiragana(text)
        }
        return kanaToHiragana(text)
    }

    private static func kanaToHiragana(_ text: String) -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            if scalar.value >= 0x30A1 && scalar.value <= 0x30F6,
               let hiragana = UnicodeScalar(scalar.value - 0x60) {
                scalars.append(hiragana)
            } else {
                scalars.append(scalar)
            }
        }
        return String(scalars)
    }

    private static func isRomaji(_ text: String) -> Bool {
        text.range(of: #"^[A-Za-z']+$"#, options: .regularExpression) != nil
    }

    private static func romajiToHiragana(_ input: String) -> String {
        let lower = input.lowercased()
        var result = ""
        var index = lower.startIndex

        while index < lower.endIndex {
            let next = lower.index(after: index)
            if next < lower.endIndex,
               lower[index] == lower[next],
               "kstpgzdbcfhjmrw".contains(lower[index]) {
                result += "っ"
                index = next
                continue
            }

            var matched = false
            for length in [3, 2, 1] {
                guard let end = lower.index(index, offsetBy: length, limitedBy: lower.endIndex) else { continue }
                let chunk = String(lower[index..<end])
                if let hiragana = romajiToHiraganaMap[chunk] {
                    result += hiragana
                    index = end
                    matched = true
                    break
                }
            }

            if !matched {
                result.append(lower[index])
                index = lower.index(after: index)
            }
        }

        return result
    }

    private static let ruleGroups: [RuleGroup] = {
        var groups: [RuleGroup] = []
        var currentLength: Int?

        for rule in rules {
            let length = rule.from.count
            if currentLength != length {
                currentLength = length
                groups.append(RuleGroup(fromLength: length, rules: []))
            }
            groups[groups.count - 1].rules.append(rule)
        }

        return groups
    }()

    private static let rules: [Rule] = [
        // -------------- 7 --------------
        Rule("ていらっしゃい", "", .initial, .taTeStem, [.respectful, .continuous, .imperative]),
        Rule("ていらっしゃる", "", .godanVerb, .taTeStem, [.respectful, .continuous]),
        Rule("でいらっしゃい", "", .initial, .daDeStem, [.respectful, .continuous, .imperative]),
        Rule("でいらっしゃる", "", .godanVerb, .daDeStem, [.respectful, .continuous]),
        // -------------- 6 --------------
        Rule("いらっしゃい", "いらっしゃる", .masuStem, .godanVerb, [.masuStem]),
        Rule("いらっしゃい", "いらっしゃる", .initial, .godanVerb, [.imperative]),
        Rule("くありません", "い", .initial, .iAdjective, [.politeNegative]),
        Rule("ざるをえない", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        Rule("ざるを得ない", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        Rule("ませんでした", "", .initial, .masuStem, [.politePastNegative]),
        Rule("てらっしゃい", "", .initial, .taTeStem, [.respectful, .continuous, .imperative]),
        Rule("てらっしゃい", "てらっしゃる", .masuStem, .godanVerb, [.masuStem]),
        Rule("てらっしゃる", "", .godanVerb, .taTeStem, [.respectful, .continuous]),
        Rule("でらっしゃい", "", .initial, .daDeStem, [.respectful, .continuous, .imperative]),
        Rule("でらっしゃい", "でらっしゃる", .masuStem, .godanVerb, [.masuStem]),
        Rule("でらっしゃる", "", .godanVerb, .daDeStem, [.respectful, .continuous]),
        // -------------- 5 --------------
        Rule("おっしゃい", "おっしゃる", .masuStem, .godanVerb, [.masuStem]),
        Rule("おっしゃい", "おっしゃる", .initial, .godanVerb, [.imperative]),
        Rule("ざるえない", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        Rule("ざる得ない", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        Rule("ざるをえぬ", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        Rule("ざるを得ぬ", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        // -------------- 4 --------------
        Rule("かったら", "い", .initial, .iAdjective, [.tara]),
        Rule("かったり", "い", .initial, .iAdjective, [.tari]),
        Rule("ください", "くださる", .masuStem, .godanVerb, [.masuStem]),
        Rule("ください", "くださる", .initial, .godanVerb, [.imperative]),
        Rule("こさせる", "くる", .ichidanVerb, .kuruVerb, [.causative]),
        Rule("こられる", "くる", .ichidanVerb, .kuruVerb, [.potentialOrPassive]),
        Rule("さないで", "する", .initial, .specialSuruVerb, [.irregular, .negativeTe]),
        Rule("ざるえぬ", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        Rule("ざる得ぬ", "", .iAdjective, .irrealisStem, [.zaruWoEnai]),
        Rule("しないで", "する", .initial, .suruVerb, [.negativeTe]),
        Rule("しさせる", "する", .ichidanVerb, .specialSuruVerb, [.irregular, .causative]),
        Rule("しられる", "する", .ichidanVerb, .specialSuruVerb, [.irregular, .potentialOrPassive]),
        Rule("せさせる", "する", .ichidanVerb, .specialSuruVerb, [.irregular, .causative]),
        Rule("せられる", "する", .ichidanVerb, .specialSuruVerb, [.irregular, .potentialOrPassive]),
        Rule("ぜさせる", "ずる", .ichidanVerb, .specialSuruVerb, [.irregular, .causative]),
        Rule("ぜられる", "ずる", .ichidanVerb, .specialSuruVerb, [.irregular, .potentialOrPassive]),
        Rule("たゆたう", "たゆたう", .taTeStem, .godanVerb, []),
        Rule("たゆとう", "たゆとう", .taTeStem, .godanVerb, []),
        Rule("のたまう", "のたまう", .taTeStem, .godanVerb, []),
        Rule("のたもう", "のたもう", .taTeStem, .godanVerb, []),
        Rule("ましたら", "", .initial, .masuStem, [.polite, .tara]),
        Rule("ましたり", "", .initial, .masuStem, [.polite, .tari]),
        Rule("ましょう", "", .initial, .masuStem, [.politeVolitional]),
        // -------------- 3 --------------
        Rule("いたす", "", .godanVerb, .masuStem, [.humble]),
        Rule("いたす", "", .godanVerb, .nounSuru, [.suruNoun, .humble]),
        Rule("かった", "い", .initial, .iAdjective, [.past]),
        Rule("下さい", "下さる", .masuStem, .godanVerb, [.masuStem]),
        Rule("下さい", "下さる", .initial, .godanVerb, [.imperative]),
        Rule("くない", "い", .iAdjective, .iAdjective, [.negative]),
        Rule("ければ", "い", .initial, .iAdjective, [.ba]),
        Rule("こよう", "くる", .initial, .kuruVerb, [.volitional]),
        Rule("これる", "くる", .ichidanVerb, .kuruVerb, [.potential]),
        Rule("来れる", "来る", .ichidanVerb, .kuruVerb, [.potential]),
        Rule("來れる", "來る", .ichidanVerb, .kuruVerb, [.potential]),
        Rule("ござい", "ござる", .masuStem, .godanVerb, [.masuStem]),
        Rule("ご座い", "ご座る", .masuStem, .godanVerb, [.masuStem]),
        Rule("御座い", "御座る", .masuStem, .godanVerb, [.masuStem]),
        Rule("させる", "る", .ichidanVerb, [.ichidanVerb, .kuruVerb], [.causative]),
        Rule("させる", "する", .ichidanVerb, .suruVerb, [.causative]),
        Rule("さない", "する", .iAdjective, .specialSuruVerb, [.irregular, .negative]),
        Rule("される", "", .ichidanVerb, .irrealisStem, [.causativePassive]),
        Rule("される", "する", .ichidanVerb, .suruVerb, [.passive]),
        Rule("しうる", "する", .initial, .suruVerb, [.eruUru]),
        Rule("しえる", "する", .ichidanVerb, .suruVerb, [.eruUru]),
        Rule("しない", "する", .iAdjective, .suruVerb, [.negative]),
        Rule("しよう", "する", .initial, .suruVerb, [.volitional]),
        Rule("じゃう", "", .godanVerb, .daDeStem, [.chau]),
        Rule("すぎる", "い", .ichidanVerb, .iAdjective, [.sugiru]),
        Rule("すぎる", "", .ichidanVerb, .masuStem, [.sugiru]),
        Rule("過ぎる", "い", .ichidanVerb, .iAdjective, [.sugiru]),
        Rule("過ぎる", "", .ichidanVerb, .masuStem, [.sugiru]),
        Rule("ずれば", "ずる", .initial, .specialSuruVerb, [.irregular, .ba]),
        Rule("たまう", "たまう", .taTeStem, .godanVerb, []),
        Rule("たもう", "たもう", .taTeStem, .godanVerb, []),
        Rule("揺蕩う", "揺蕩う", .taTeStem, .godanVerb, []),
        Rule("ちゃう", "", .godanVerb, .taTeStem, [.chau]),
        Rule("ている", "", .ichidanVerb, .taTeStem, [.continuous]),
        Rule("ておる", "", .godanVerb, .taTeStem, [.humbleOrKansaiDialect, .continuous]),
        Rule("でいる", "", .ichidanVerb, .daDeStem, [.continuous]),
        Rule("でおる", "", .godanVerb, .daDeStem, [.humbleOrKansaiDialect, .continuous]),
        Rule("できる", "する", .ichidanVerb, .suruVerb, [.potential]),
        Rule("ないで", "", .initial, .irrealisStem, [.negativeTe]),
        Rule("なさい", "", .initial, .masuStem, [.respectful, .imperative]),
        Rule("なさい", "なさる", .masuStem, .godanVerb, [.masuStem]),
        Rule("なさい", "なさる", .initial, .godanVerb, [.imperative]),
        Rule("なさる", "", .godanVerb, .masuStem, [.respectful]),
        Rule("なさる", "", .godanVerb, .nounSuru, [.suruNoun, .respectful]),
        Rule("になる", "", .godanVerb, .masuStem, [.respectful]),
        Rule("になる", "", .godanVerb, .nounSuru, [.suruNoun, .respectful]),
        Rule("ました", "", .initial, .masuStem, [.politePast]),
        Rule("まして", "", .initial, .masuStem, [.polite, .te]),
        Rule("ません", "", .initial, .masuStem, [.politeNegative]),
        Rule("られる", "る", .ichidanVerb, [.ichidanVerb, .kuruVerb], [.potentialOrPassive]),
        // -------------- 2 --------------
        Rule("致す", "", .godanVerb, .masuStem, [.humble]),
        Rule("致す", "", .godanVerb, .nounSuru, [.suruNoun, .humble]),
        Rule("えば", "う", .initial, .godanVerb, [.ba]),
        Rule("える", "う", .ichidanVerb, .godanVerb, [.potential]),
        Rule("得る", "", .ichidanVerb, .masuStem, [.eruUru]),
        Rule("おう", "う", .initial, .godanVerb, [.volitional]),
        Rule("仰い", "仰る", .masuStem, .godanVerb, [.masuStem]),
        Rule("仰い", "仰る", .initial, .godanVerb, [.imperative]),
        Rule("くて", "い", .initial, .iAdjective, [.te]),
        Rule("けば", "く", .initial, .godanVerb, [.ba]),
        Rule("げば", "ぐ", .initial, .godanVerb, [.ba]),
        Rule("ける", "く", .ichidanVerb, .godanVerb, [.potential]),
        Rule("げる", "ぐ", .ichidanVerb, .godanVerb, [.potential]),
        Rule("こい", "くる", .initial, .kuruVerb, [.imperative]),
        Rule("こう", "く", .initial, .godanVerb, [.volitional]),
        Rule("ごう", "ぐ", .initial, .godanVerb, [.volitional]),
        Rule("しろ", "する", .initial, .suruVerb, [.imperative]),
        Rule("さず", "する", .initial, .specialSuruVerb, [.irregular, .zu]),
        Rule("すぎ", "い", .initial, .iAdjective, [.sugiru]),
        Rule("すぎ", "", .initial, .masuStem, [.sugiru]),
        Rule("過ぎ", "い", .initial, .iAdjective, [.sugiru]),
        Rule("過ぎ", "", .initial, .masuStem, [.sugiru]),
        Rule("する", "", .suruVerb, .nounSuru, [.suruNoun]),
        Rule("せず", "する", .initial, .suruVerb, [.zu]),
        Rule("せぬ", "する", .initial, .suruVerb, [.negative]),
        Rule("せん", "する", .initial, .suruVerb, [.negative]),
        Rule("せば", "す", .initial, .godanVerb, [.ba]),
        Rule("せば", "する", .initial, .specialSuruVerb, [.irregular, .ba]),
        Rule("せよ", "する", .initial, .suruVerb, [.imperative]),
        Rule("せる", "す", .ichidanVerb, .godanVerb, [.potential]),
        Rule("せる", "", .ichidanVerb, .irrealisStem, [.causative]),
        Rule("ぜず", "ずる", .initial, .specialSuruVerb, [.irregular, .zu]),
        Rule("ぜぬ", "ずる", .initial, .specialSuruVerb, [.irregular, .negative]),
        Rule("ぜよ", "ずる", .initial, .specialSuruVerb, [.irregular, .imperative]),
        Rule("そう", "", .initial, .masuStem, [.sou]),
        Rule("そう", "い", .initial, .iAdjective, [.sou]),
        Rule("そう", "す", .initial, .godanVerb, [.volitional]),
        Rule("そう", "する", .initial, .specialSuruVerb, [.irregular, .volitional]),
        Rule("たい", "", .iAdjective, .masuStem, [.tai]),
        Rule("たら", "", .initial, .taTeStem, [.tara]),
        Rule("だら", "", .initial, .daDeStem, [.tara]),
        Rule("たり", "", .initial, .taTeStem, [.tari]),
        Rule("だり", "", .initial, .daDeStem, [.tari]),
        Rule("てば", "つ", .initial, .godanVerb, [.ba]),
        Rule("てる", "つ", .ichidanVerb, .godanVerb, [.potential]),
        Rule("てる", "", .ichidanVerb, .taTeStem, [.continuous]),
        Rule("でる", "", .ichidanVerb, .daDeStem, [.continuous]),
        Rule("とう", "つ", .initial, .godanVerb, [.volitional]),
        Rule("とく", "", .godanVerb, .taTeStem, [.toku]),
        Rule("とる", "", .godanVerb, .taTeStem, [.humbleOrKansaiDialect, .continuous]),
        Rule("どく", "", .godanVerb, .daDeStem, [.toku]),
        Rule("どる", "", .godanVerb, .daDeStem, [.humbleOrKansaiDialect, .continuous]),
        Rule("ない", "", .iAdjective, .irrealisStem, [.negative]),
        Rule("ねば", "ぬ", .initial, .godanVerb, [.ba]),
        Rule("ねる", "ぬ", .ichidanVerb, .godanVerb, [.potential]),
        Rule("のう", "ぬ", .initial, .godanVerb, [.volitional]),
        Rule("べば", "ぶ", .initial, .godanVerb, [.ba]),
        Rule("べる", "ぶ", .ichidanVerb, .godanVerb, [.potential]),
        Rule("ぼう", "ぶ", .initial, .godanVerb, [.volitional]),
        Rule("ます", "", .initial, .masuStem, [.polite]),
        Rule("ませ", "", .initial, .masuStem, [.polite, .imperative]),
        Rule("めば", "む", .initial, .godanVerb, [.ba]),
        Rule("める", "む", .ichidanVerb, .godanVerb, [.potential]),
        Rule("もう", "む", .initial, .godanVerb, [.volitional]),
        Rule("よう", "る", .initial, [.ichidanVerb, .kuruVerb], [.volitional]),
        Rule("れば", "る", .initial, [.ichidanVerb, .godanVerb, .kuruVerb, .suruVerb], [.ba]),
        Rule("れる", "る", .ichidanVerb, [.ichidanVerb, .godanVerb], [.potential]),
        Rule("れる", "", .ichidanVerb, .irrealisStem, [.passive]),
        Rule("ろう", "る", .initial, .godanVerb, [.volitional]),
        // Irregular て-form stems
        Rule("いっ", "いく", .taTeStem, .godanVerb, []),
        Rule("おう", "おう", .taTeStem, .godanVerb, []),
        Rule("こう", "こう", .taTeStem, .godanVerb, []),
        Rule("そう", "そう", .taTeStem, .godanVerb, []),
        Rule("とう", "とう", .taTeStem, .godanVerb, []),
        Rule("行っ", "行く", .taTeStem, .godanVerb, []),
        Rule("逝っ", "逝く", .taTeStem, .godanVerb, []),
        Rule("往っ", "往く", .taTeStem, .godanVerb, []),
        Rule("請う", "請う", .taTeStem, .godanVerb, []),
        Rule("乞う", "乞う", .taTeStem, .godanVerb, []),
        Rule("恋う", "恋う", .taTeStem, .godanVerb, []),
        Rule("問う", "問う", .taTeStem, .godanVerb, []),
        Rule("負う", "負う", .taTeStem, .godanVerb, []),
        Rule("沿う", "沿う", .taTeStem, .godanVerb, []),
        Rule("添う", "添う", .taTeStem, .godanVerb, []),
        Rule("副う", "副う", .taTeStem, .godanVerb, []),
        Rule("厭う", "厭う", .taTeStem, .godanVerb, []),
        Rule("給う", "給う", .taTeStem, .godanVerb, []),
        Rule("賜う", "賜う", .taTeStem, .godanVerb, []),
        Rule("宣う", "宣う", .taTeStem, .godanVerb, []),
        Rule("曰う", "曰う", .taTeStem, .godanVerb, []),
        // -------------- 1 --------------
        Rule("い", "う", .masuStem, .godanVerb, [.masuStem]),
        Rule("い", "く", .taTeStem, .godanVerb, []),
        Rule("い", "ぐ", .daDeStem, .godanVerb, []),
        Rule("い", "る", .initial, .kuruVerb, [.imperative]),
        Rule("え", "う", .initial, .godanVerb, [.imperative]),
        Rule("か", "く", .irrealisStem, .godanVerb, []),
        Rule("が", "ぐ", .irrealisStem, .godanVerb, []),
        Rule("き", "い", .initial, .iAdjective, [.ki]),
        Rule("き", "く", .masuStem, .godanVerb, [.masuStem]),
        Rule("き", "くる", .taTeStem, .kuruVerb, []),
        Rule("き", "くる", .masuStem, .kuruVerb, [.masuStem]),
        Rule("ぎ", "ぐ", .masuStem, .godanVerb, [.masuStem]),
        Rule("く", "い", .initial, .iAdjective, [.adverbial]),
        Rule("け", "く", .initial, .godanVerb, [.imperative]),
        Rule("げ", "ぐ", .initial, .godanVerb, [.imperative]),
        Rule("こ", "くる", .irrealisStem, .kuruVerb, []),
        Rule("さ", "い", .initial, .iAdjective, [.noun]),
        Rule("さ", "す", .irrealisStem, .godanVerb, []),
        Rule("し", "す", .masuStem, .godanVerb, [.masuStem]),
        Rule("し", "する", .masuStem, .suruVerb, [.masuStem]),
        Rule("し", "す", .taTeStem, .godanVerb, []),
        Rule("し", "する", .taTeStem, .suruVerb, []),
        Rule("ず", "", .initial, .irrealisStem, [.zu]),
        Rule("せ", "す", .initial, .godanVerb, [.imperative]),
        Rule("せ", "する", .initial, .specialSuruVerb, [.irregular, .imperative]),
        Rule("た", "つ", .irrealisStem, .godanVerb, []),
        Rule("た", "", .initial, .taTeStem, [.past]),
        Rule("だ", "", .initial, .daDeStem, [.past]),
        Rule("ち", "つ", .masuStem, .godanVerb, [.masuStem]),
        Rule("っ", "う", .taTeStem, .godanVerb, []),
        Rule("っ", "つ", .taTeStem, .godanVerb, []),
        Rule("っ", "る", .taTeStem, .godanVerb, []),
        Rule("て", "", .initial, .taTeStem, [.te]),
        Rule("て", "つ", .initial, .godanVerb, [.imperative]),
        Rule("で", "", .initial, .daDeStem, [.te]),
        Rule("な", "ぬ", .irrealisStem, .godanVerb, []),
        Rule("な", "", .initial, [.ichidanVerb, .godanVerb, .kuruVerb, .suruVerb], [.imperativeNegative]),
        Rule("に", "ぬ", .masuStem, .godanVerb, [.masuStem]),
        Rule("ぬ", "", .initial, .irrealisStem, [.negative]),
        Rule("ね", "ぬ", .initial, .godanVerb, [.imperative]),
        Rule("ば", "ぶ", .irrealisStem, .godanVerb, []),
        Rule("び", "ぶ", .masuStem, .godanVerb, [.masuStem]),
        Rule("べ", "ぶ", .initial, .godanVerb, [.imperative]),
        Rule("ま", "む", .irrealisStem, .godanVerb, []),
        Rule("み", "む", .masuStem, .godanVerb, [.masuStem]),
        Rule("め", "む", .initial, .godanVerb, [.imperative]),
        Rule("よ", "る", .initial, .ichidanVerb, [.imperative]),
        Rule("ら", "る", .irrealisStem, .godanVerb, []),
        Rule("り", "る", .masuStem, .godanVerb, [.masuStem]),
        Rule("れ", "る", .initial, .godanVerb, [.imperative]),
        Rule("ろ", "る", .initial, .ichidanVerb, [.imperative]),
        Rule("わ", "う", .irrealisStem, .godanVerb, []),
        Rule("ん", "ぬ", .daDeStem, .godanVerb, []),
        Rule("ん", "ぶ", .daDeStem, .godanVerb, []),
        Rule("ん", "む", .daDeStem, .godanVerb, []),
        Rule("ん", "", .initial, .irrealisStem, [.negative])
    ]
}

enum KoreanDeinflector {
    private struct Rule {
        var from: String
        var to: String
        var labels: [String]
    }

    private struct VowelContractionRule {
        var contractedMedial: Int
        var originalMedial: Int
    }

    private struct ParticleRule {
        var particle: String
        var label: String
        var afterVowel: Bool
    }

    private static let hangulStart = 0xAC00
    private static let hangulEnd = 0xD7A3
    private static let medialCount = 21
    private static let finalCount = 28

    private static let finalNone = 0
    private static let finalDigeut = 7
    private static let finalRieul = 8
    private static let finalBieup = 17
    private static let finalSiot = 19
    private static let finalSsangSiot = 20

    private static let medialA = 0
    private static let medialAE = 1
    private static let medialEO = 4
    private static let medialE = 5
    private static let medialO = 8
    private static let medialWA = 9
    private static let medialU = 13
    private static let medialWEO = 14
    private static let medialI = 20
    private static let medialYEO = 6

    private static let rules: [Rule] = [
        Rule(from: "해요", to: "하다", labels: ["polite"]),
        Rule(from: "했어요", to: "하다", labels: ["past", "polite"]),
        Rule(from: "했어", to: "하다", labels: ["past", "casual"]),
        Rule(from: "해", to: "하다", labels: ["casual"]),
        Rule(from: "합니다", to: "하다", labels: ["formal"]),
        Rule(from: "했습니다", to: "하다", labels: ["past", "formal"]),
        Rule(from: "하겠어요", to: "하다", labels: ["future", "polite"]),
        Rule(from: "할 거예요", to: "하다", labels: ["future", "polite"]),
        Rule(from: "하세요", to: "하다", labels: ["honorific", "polite"]),
        Rule(from: "하셨어요", to: "하다", labels: ["honorific", "past", "polite"]),
        Rule(from: "하고", to: "하다", labels: ["connective"]),
        Rule(from: "해서", to: "하다", labels: ["reason"]),
        Rule(from: "하면", to: "하다", labels: ["conditional"]),
        Rule(from: "하지만", to: "하다", labels: ["although"]),
        Rule(from: "하지 않아요", to: "하다", labels: ["negative polite"]),
        Rule(from: "안 해요", to: "하다", labels: ["negative polite"]),
        Rule(from: "하고 싶어요", to: "하다", labels: ["want", "polite"]),
        Rule(from: "하고 있어요", to: "하다", labels: ["progressive", "polite"]),
        Rule(from: "하자", to: "하다", labels: ["propositive"]),
        Rule(from: "할까요", to: "하다", labels: ["question", "future"]),

        Rule(from: "아요", to: "다", labels: ["polite"]),
        Rule(from: "어요", to: "다", labels: ["polite"]),
        Rule(from: "여요", to: "다", labels: ["polite"]),
        Rule(from: "았어요", to: "다", labels: ["past", "polite"]),
        Rule(from: "었어요", to: "다", labels: ["past", "polite"]),
        Rule(from: "였어요", to: "다", labels: ["past", "polite"]),
        Rule(from: "아", to: "다", labels: ["casual"]),
        Rule(from: "어", to: "다", labels: ["casual"]),
        Rule(from: "여", to: "다", labels: ["casual"]),
        Rule(from: "았어", to: "다", labels: ["past", "casual"]),
        Rule(from: "었어", to: "다", labels: ["past", "casual"]),
        Rule(from: "였어", to: "다", labels: ["past", "casual"]),
        Rule(from: "습니다", to: "다", labels: ["formal"]),
        Rule(from: "ㅂ니다", to: "다", labels: ["formal"]),
        Rule(from: "았습니다", to: "다", labels: ["past", "formal"]),
        Rule(from: "었습니다", to: "다", labels: ["past", "formal"]),
        Rule(from: "였습니다", to: "다", labels: ["past", "formal"]),
        Rule(from: "겠어요", to: "다", labels: ["future", "polite"]),
        Rule(from: "겠어", to: "다", labels: ["future", "casual"]),
        Rule(from: "겠습니다", to: "다", labels: ["future", "formal"]),
        Rule(from: "고", to: "다", labels: ["connective"]),
        Rule(from: "아서", to: "다", labels: ["reason"]),
        Rule(from: "어서", to: "다", labels: ["reason"]),
        Rule(from: "여서", to: "다", labels: ["reason"]),
        Rule(from: "면", to: "다", labels: ["conditional"]),
        Rule(from: "으면", to: "다", labels: ["conditional"]),
        Rule(from: "지만", to: "다", labels: ["although"]),
        Rule(from: "지 않아요", to: "다", labels: ["negative polite"]),
        Rule(from: "지 않아", to: "다", labels: ["negative"]),
        Rule(from: "지 않습니다", to: "다", labels: ["negative", "formal"]),
        Rule(from: "고 있어요", to: "다", labels: ["progressive", "polite"]),
        Rule(from: "고있어요", to: "다", labels: ["progressive", "polite"]),
        Rule(from: "고 있어", to: "다", labels: ["progressive", "casual"]),
        Rule(from: "고있어", to: "다", labels: ["progressive", "casual"]),
        Rule(from: "고 있습니다", to: "다", labels: ["progressive", "formal"]),
        Rule(from: "고있습니다", to: "다", labels: ["progressive", "formal"]),
        Rule(from: "고 싶어요", to: "다", labels: ["want", "polite"]),
        Rule(from: "고싶어요", to: "다", labels: ["want", "polite"]),
        Rule(from: "고 싶어", to: "다", labels: ["want", "casual"]),
        Rule(from: "고싶어", to: "다", labels: ["want", "casual"]),
        Rule(from: "고 싶습니다", to: "다", labels: ["want", "formal"]),
        Rule(from: "고싶습니다", to: "다", labels: ["want", "formal"]),
        Rule(from: "세요", to: "다", labels: ["imperative", "honorific"]),
        Rule(from: "으세요", to: "다", labels: ["imperative", "honorific"]),
        Rule(from: "아라", to: "다", labels: ["imperative"]),
        Rule(from: "어라", to: "다", labels: ["imperative"]),
        Rule(from: "자", to: "다", labels: ["propositive"]),
        Rule(from: "아요?", to: "다", labels: ["question", "polite"]),
        Rule(from: "어요?", to: "다", labels: ["question", "polite"]),
        Rule(from: "습니까", to: "다", labels: ["question", "formal"]),
        Rule(from: "ㅂ니까", to: "다", labels: ["question", "formal"]),
        Rule(from: "을까요", to: "다", labels: ["question", "future"]),
        Rule(from: "ㄹ까요", to: "다", labels: ["question", "future"]),
        Rule(from: "셨어요", to: "다", labels: ["honorific", "past", "polite"]),
        Rule(from: "셨어", to: "다", labels: ["honorific", "past", "casual"]),
        Rule(from: "셨습니다", to: "다", labels: ["honorific", "past", "formal"])
    ]

    private static let vowelContractionRules = [
        VowelContractionRule(contractedMedial: medialA, originalMedial: medialA),
        VowelContractionRule(contractedMedial: medialWA, originalMedial: medialO),
        VowelContractionRule(contractedMedial: medialWEO, originalMedial: medialU),
        VowelContractionRule(contractedMedial: medialEO, originalMedial: medialEO),
        VowelContractionRule(contractedMedial: medialYEO, originalMedial: medialI),
        VowelContractionRule(contractedMedial: medialAE, originalMedial: medialAE),
        VowelContractionRule(contractedMedial: medialE, originalMedial: medialE)
    ]

    private static let particleRules = [
        ParticleRule(particle: "가", label: "subject", afterVowel: true),
        ParticleRule(particle: "이", label: "subject", afterVowel: false),
        ParticleRule(particle: "는", label: "topic", afterVowel: true),
        ParticleRule(particle: "은", label: "topic", afterVowel: false),
        ParticleRule(particle: "를", label: "object", afterVowel: true),
        ParticleRule(particle: "을", label: "object", afterVowel: false),
        ParticleRule(particle: "의", label: "possessive", afterVowel: true),
        ParticleRule(particle: "의", label: "possessive", afterVowel: false)
    ]

    static func candidates(for input: String, limit: Int = 64) -> [KoreanDeinflectionCandidate] {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard containsHangul(trimmed) else { return [] }

        var output: [KoreanDeinflectionCandidate] = []
        var seen = Set<String>()

        func add(_ word: String, labels: [String], depth: Int = 1) {
            let candidate = word.trimmingCharacters(in: .whitespacesAndNewlines)
            let label = labels.joined(separator: "+")
            guard !candidate.isEmpty, candidate != trimmed, !label.isEmpty else { return }
            guard seen.insert(candidate).inserted else { return }
            output.append(KoreanDeinflectionCandidate(word: candidate, conjugationInfo: label, depth: depth))
        }

        for rule in rules where trimmed.hasSuffix(rule.from) {
            let stem = String(trimmed.dropLast(rule.from.count))
            add(stem + rule.to, labels: rule.labels)

            for irregular in tryBieupIrregular(stem) + tryDigeutIrregular(stem) + trySiotIrregular(stem) + tryReuIrregular(stem) {
                add(irregular, labels: rule.labels, depth: 2)
            }
        }

        for (ending, labels) in [("요", ["polite"]), ("서", ["reason"]), ("", ["casual"])] {
            for candidate in tryVowelContraction(word: trimmed, ending: ending) {
                add(candidate, labels: labels)
            }
        }

        for (ending, labels) in [
            ("어요", ["past", "polite"]),
            ("어", ["past", "casual"]),
            ("습니다", ["past", "formal"])
        ] {
            guard trimmed.hasSuffix(ending) else { continue }
            let beforeEnding = String(trimmed.dropLast(ending.count))
            guard let last = beforeEnding.last,
                  let jamo = decomposeHangul(last),
                  jamo.final == finalSsangSiot else { continue }
            for rule in vowelContractionRules where jamo.medial == rule.contractedMedial {
                let original = composeHangul(initial: jamo.initial, medial: rule.originalMedial, final: finalNone)
                add(String(beforeEnding.dropLast()) + original + "다", labels: labels)
            }
        }

        if trimmed.contains("했") || trimmed.contains("해") || trimmed.contains("합") {
            let hadaPatterns: [(String, [String])] = [
                ("했어요", ["past", "polite"]),
                ("했어", ["past", "casual"]),
                ("해요", ["polite"]),
                ("해", ["casual"]),
                ("합니다", ["formal"]),
                ("했습니다", ["past", "formal"])
            ]
            for (from, labels) in hadaPatterns where trimmed.hasSuffix(from) {
                add(String(trimmed.dropLast(from.count)) + "하다", labels: labels)
            }
        }

        for candidate in stripParticles(trimmed) {
            add(candidate.word, labels: [candidate.label])
        }

        return output
            .sorted {
                if $0.depth != $1.depth { return $0.depth < $1.depth }
                if $0.conjugationInfo.count != $1.conjugationInfo.count { return $0.conjugationInfo.count < $1.conjugationInfo.count }
                if $0.word.count != $1.word.count { return $0.word.count < $1.word.count }
                return $0.word < $1.word
            }
            .prefix(limit)
            .map { $0 }
    }

    static func isHangulOnly(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return trimmed.unicodeScalars.allSatisfy { scalar in
            (0xAC00...0xD7A3).contains(Int(scalar.value)) ||
            (0x1100...0x11FF).contains(Int(scalar.value)) ||
            (0x3130...0x318F).contains(Int(scalar.value))
        }
    }

    private static func containsHangul(_ text: String) -> Bool {
        text.unicodeScalars.contains { scalar in
            (0xAC00...0xD7A3).contains(Int(scalar.value)) ||
            (0x1100...0x11FF).contains(Int(scalar.value)) ||
            (0x3130...0x318F).contains(Int(scalar.value))
        }
    }

    private static func decomposeHangul(_ character: Character) -> (initial: Int, medial: Int, final: Int)? {
        let scalars = String(character).unicodeScalars
        guard scalars.count == 1, let scalar = scalars.first else { return nil }
        let value = Int(scalar.value)
        guard value >= hangulStart, value <= hangulEnd else { return nil }
        let offset = value - hangulStart
        let final = offset % finalCount
        let medial = (offset / finalCount) % medialCount
        let initial = offset / (finalCount * medialCount)
        return (initial, medial, final)
    }

    private static func composeHangul(initial: Int, medial: Int, final: Int) -> String {
        let value = hangulStart + (initial * medialCount + medial) * finalCount + final
        guard let scalar = UnicodeScalar(value) else { return "" }
        return String(scalar)
    }

    private static func tryBieupIrregular(_ stem: String) -> [String] {
        let chars = Array(stem)
        guard chars.count >= 2 else { return [] }
        let last = chars[chars.count - 1]
        let secondLast = chars[chars.count - 2]
        guard (last == "워" || last == "와" || last == "운" || last == "움"),
              let jamo = decomposeHangul(secondLast),
              jamo.final == finalNone else { return [] }
        let restored = composeHangul(initial: jamo.initial, medial: jamo.medial, final: finalBieup)
        return [String(chars.dropLast(2)) + restored + "다"]
    }

    private static func tryDigeutIrregular(_ stem: String) -> [String] {
        guard let last = stem.last,
              let jamo = decomposeHangul(last),
              jamo.final == finalRieul else { return [] }
        let restored = composeHangul(initial: jamo.initial, medial: jamo.medial, final: finalDigeut)
        return [String(stem.dropLast()) + restored + "다"]
    }

    private static func trySiotIrregular(_ stem: String) -> [String] {
        guard let last = stem.last,
              let jamo = decomposeHangul(last),
              jamo.final == finalNone else { return [] }
        let restored = composeHangul(initial: jamo.initial, medial: jamo.medial, final: finalSiot)
        return [String(stem.dropLast()) + restored + "다"]
    }

    private static func tryReuIrregular(_ stem: String) -> [String] {
        let chars = Array(stem)
        guard chars.count >= 2 else { return [] }
        let last = chars[chars.count - 1]
        let secondLast = chars[chars.count - 2]
        guard (last == "라" || last == "러"),
              let jamo = decomposeHangul(secondLast),
              jamo.final == finalRieul else { return [] }
        let restored = composeHangul(initial: jamo.initial, medial: jamo.medial, final: finalNone)
        return [String(chars.dropLast(2)) + restored + "르다"]
    }

    private static func tryVowelContraction(word: String, ending: String) -> [String] {
        if !ending.isEmpty && !word.hasSuffix(ending) { return [] }
        let beforeEnding = ending.isEmpty ? word : String(word.dropLast(ending.count))
        guard let last = beforeEnding.last,
              let jamo = decomposeHangul(last) else { return [] }

        var results: [String] = []
        for rule in vowelContractionRules where jamo.medial == rule.contractedMedial {
            let restored = composeHangul(initial: jamo.initial, medial: rule.originalMedial, final: jamo.final)
            results.append(String(beforeEnding.dropLast()) + restored + "다")
        }
        return results
    }

    private static func stripParticles(_ word: String) -> [(word: String, label: String)] {
        var results: [(word: String, label: String)] = []
        guard word.count >= 2 else { return results }

        let contractions: [(contracted: String, original: String, particle: String, label: String)] = [
            ("내", "나", "가", "subject"),
            ("제", "저", "가", "subject"),
            ("네", "너", "가", "subject")
        ]
        for item in contractions where word == item.contracted + item.particle {
            results.append((item.original, item.label))
        }
        if word == "누가" {
            results.append(("누구", "subject"))
        }

        for rule in particleRules where word.hasSuffix(rule.particle) && word.count > rule.particle.count {
            let stem = String(word.dropLast(rule.particle.count))
            guard let last = stem.last, let jamo = decomposeHangul(last) else { continue }
            let hasFinal = jamo.final != finalNone
            if rule.afterVowel == !hasFinal || rule.particle == "의" {
                results.append((stem, rule.label))
            }
        }

        var seen = Set<String>()
        return results.filter { seen.insert("\($0.word)|\($0.label)").inserted }
    }
}

struct CharacterSummary: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(form)-\(variantLabel)" }
    var language: LanguageCode
    var form: String
    var variantLabel: String
    var readings: [String]
    var meanings: [String]
    var tags: [String]
    var components: [CharacterComponent]
    var componentUses: [CharacterComponentUseGroup] = []
    var notes: [String]
    var facts: [CharacterFact] = []
    var variants: [CharacterVariantSummary] = []
    var topWords: [CharacterTopWord] = []
    var oldPronunciations: [CharacterPronunciationHistory] = []
    var comments: [CharacterComment] = []
    var images: [CharacterImageReference] = []
    var strokeSet: CharacterStrokeSet? = nil
}

struct CharacterComponent: Identifiable, Hashable {
    var id: String { "\(character)-\(role)-\(meaning)" }
    var character: String
    var meaning: String
    var role: String
    var dictionaryMeaning: String = ""
    var pinyin: String = ""
    var hint: String = ""
    var componentIndex: Int = 0

    var roleTokens: [String] {
        role
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty }
    }

    var roleLabel: String {
        if roleTokens.contains("meaning") { return "Meaning component" }
        if roleTokens.contains("phonetic") || roleTokens.contains("sound") { return "Phonetic component" }
        if roleTokens.contains("iconic") { return "Iconic component" }
        if roleTokens.contains("simplified") { return "Simplified component" }
        if roleTokens.contains("distinguishing") { return "Distinguishing component" }
        if roleTokens.contains("remnant") { return "Remnant component" }
        if roleTokens.contains("deleted") { return "Deleted component" }
        if roleTokens.contains("unknown") { return "Unknown component" }
        return role.isEmpty ? "" : "\(role) component"
    }

    var isPhonetic: Bool {
        roleTokens.contains("phonetic") || roleTokens.contains("sound")
    }

    var highlightColor: Color {
        if roleTokens.contains("meaning") { return .green }
        if isPhonetic { return .red }
        if roleTokens.contains("iconic") { return .blue }
        if roleTokens.contains("simplified") { return .purple }
        if roleTokens.contains("distinguishing") { return .orange }
        return .secondary
    }

    var secondaryMeaning: String {
        let cleanedDictionaryMeaning = dictionaryMeaning.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanedDictionaryMeaning.isEmpty else { return "" }
        if cleanedDictionaryMeaning.caseInsensitiveCompare(meaning) == .orderedSame {
            return ""
        }
        return cleanedDictionaryMeaning
    }
}

private let componentUseRoleOrder = ["meaning", "sound", "iconic", "simplified", "distinguishing", "remnant", "deleted", "unknown"]

private let componentUseRoleDisplayNames: [String: String] = [
    "meaning": "Meaning component",
    "sound": "Sound component",
    "iconic": "Iconic component",
    "simplified": "Simplified component",
    "distinguishing": "Distinguishing component",
    "remnant": "Remnant component",
    "deleted": "Deleted component",
    "unknown": "Unknown component"
]

struct CharacterComponentUseGroup: Identifiable, Hashable {
    var id: String { role }
    var role: String
    var chars: [String]
    var count: Int
    var verified: Int

    var displayName: String {
        componentUseRoleDisplayNames[role] ?? role
    }
}

struct CharacterStrokeSet: Hashable {
    var source: String
    var strokes: [String]
    var matches: [[Int]]
}

struct EntryPreview: Identifiable, Hashable {
    var id: String { "\(word)-\(reading)-\(definition)" }
    var word: String
    var reading: String
    var definition: String
    var isCommon: Bool
    var frequencyRank: Int? = nil
}

struct SimilarCharacter: Identifiable, Hashable {
    var id: String { character }
    var character: String
    var sharedComponents: [String]
    var score: Int
    var gloss: String
}

struct CharacterFormSummary: Identifiable, Hashable {
    var id: String { form }
    var form: String
    var labels: [String]
    var readings: [String]
    var meanings: [String]
    var tags: [String]

    var labelText: String {
        labels.joined(separator: " / ")
    }

    static func forms(for record: DictionaryRecord) -> [CharacterFormSummary] {
        var forms: [String: CharacterFormSummary] = [:]
        var order: [String] = []

        func add(
            form: String,
            label: String,
            readings: [String] = [],
            meanings: [String] = [],
            tags: [String] = []
        ) {
            let normalized = form.trimmingCharacters(in: .whitespacesAndNewlines)
            guard normalized.count == 1 else { return }
            if forms[normalized] == nil {
                forms[normalized] = CharacterFormSummary(
                    form: normalized,
                    labels: [],
                    readings: [],
                    meanings: [],
                    tags: []
                )
                order.append(normalized)
            }
            guard var item = forms[normalized] else { return }
            item.labels = uniqueNonEmpty(item.labels + [label])
            item.readings = uniqueNonEmpty(item.readings + readings)
            item.meanings = uniqueNonEmpty(item.meanings + meanings)
            item.tags = uniqueNonEmpty(item.tags + tags.filter(Self.isProminentTag))
            forms[normalized] = item
        }

        for entry in record.chineseWordEntries {
            add(form: entry.traditional, label: "Traditional", readings: [entry.displayReading], meanings: entry.allDefinitions, tags: [])
            add(form: entry.simplified, label: "Simplified", readings: [entry.displayReading], meanings: entry.allDefinitions, tags: [])
        }

        for character in record.characters where character.language == .zh {
            add(
                form: character.form,
                label: "Traditional",
                readings: character.readings,
                meanings: character.meanings,
                tags: character.tags
            )
            let simplifiedVariants = character.variants.filter { variant in
                variant.label.localizedCaseInsensitiveContains("simplified")
                    || variant.source.localizedCaseInsensitiveContains("simplified")
            }
            if simplifiedVariants.isEmpty {
                add(form: character.form, label: "Simplified")
            } else {
                for variant in simplifiedVariants {
                    add(
                        form: variant.character,
                        label: "Simplified",
                        readings: character.readings,
                        meanings: character.meanings,
                        tags: character.tags
                    )
                }
            }
            for variant in character.variants where variant.label.localizedCaseInsensitiveContains("Hong Kong") || variant.source.localizedCaseInsensitiveContains("Hong Kong") {
                add(form: variant.character, label: "Hong Kong", readings: character.readings, meanings: character.meanings, tags: character.tags)
            }
        }

        for character in record.characters where character.language == .ja {
            add(form: character.form, label: "Japanese", readings: character.readings, meanings: character.meanings, tags: character.tags)
        }
        for entry in record.japaneseWordEntries {
            let readings = uniqueNonEmpty([entry.displayReading])
            for headword in entry.visibleKanji where headword.text.count == 1 {
                add(form: headword.text, label: "Japanese", readings: readings, meanings: entry.flattenedDefinitions, tags: entry.flattenedTags)
            }
        }
        for section in record.japanese where section.headword.count == 1 {
            add(form: section.headword, label: "Japanese", readings: [section.reading], meanings: section.definitions, tags: section.tags)
        }

        for character in record.characters where character.language == .ko {
            add(form: character.form, label: "Korean", readings: character.readings, meanings: character.meanings, tags: character.tags)
        }
        for entry in record.koreanWordEntries where entry.hanja.count == 1 {
            let rankTags = entry.frequencyRank.map { ["rank \($0)"] } ?? []
            add(
                form: entry.hanja,
                label: "Korean",
                readings: [entry.displayReading],
                meanings: entry.definitions.map(\.text),
                tags: [entry.partOfSpeech, entry.origin] + rankTags
            )
        }
        for section in record.korean where section.headword.count == 1 {
            add(form: section.headword, label: "Korean", readings: [section.reading], meanings: section.definitions, tags: section.tags)
        }

        return order.compactMap { forms[$0] }
            .sorted { lhs, rhs in
                let lhsRank = displayRank(for: lhs)
                let rhsRank = displayRank(for: rhs)
                if lhsRank != rhsRank { return lhsRank < rhsRank }
                guard let lhsIndex = order.firstIndex(of: lhs.form),
                      let rhsIndex = order.firstIndex(of: rhs.form) else {
                    return lhs.form < rhs.form
                }
                return lhsIndex < rhsIndex
            }
    }

    private static func isProminentTag(_ tag: String) -> Bool {
        let lowered = tag.lowercased()
        return lowered.hasPrefix("hsk")
            || lowered.hasPrefix("jlpt")
            || lowered.hasPrefix("grade")
            || lowered.hasPrefix("frequency")
            || lowered.hasPrefix("rank")
            || lowered.contains("strokes")
    }

    private static func displayRank(for item: CharacterFormSummary) -> Int {
        item.labels.map(labelRank).min() ?? 99
    }

    private static func labelRank(_ label: String) -> Int {
        switch label {
        case "Traditional":
            return 0
        case "Simplified":
            return 1
        case "Japanese":
            return 2
        case "Korean":
            return 3
        case "Hong Kong":
            return 4
        default:
            return 90
        }
    }
}

struct ComponentUseBucket: Hashable {
    var chars: [String]
    var count: Int
    var verified: Int = 0
}

typealias ComponentUseIndex = [String: [String: ComponentUseBucket]]

struct PhoneticSeriesCharacter: Identifiable, Hashable {
    var id: String { character }
    var character: String
    var pinyin: [String]
    var gloss: String

    var primaryReading: String {
        let first = pinyin.first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return first.isEmpty ? "none" : first
    }
}

struct JapaneseNameSummary: Identifiable, Hashable {
    var id: String
    var kanji: [String]
    var kana: [String]
    var translations: [String]
    var tags: [String]
}

struct WordSection: Identifiable, Hashable {
    var id = UUID()
    var language: LanguageCode
    var headword: String
    var reading: String
    var definitions: [String]
    var tags: [String] = []
    var examples: [SentenceExample] = []
    var pitchAccent: PitchAccentPattern? = nil
}

struct ChineseWordEntry: Identifiable, Hashable {
    var id: String
    var simplified: String
    var traditional: String
    var items: [ChineseWordItem]
    var gloss: String
    var pinyinSearchString: String
    var jyutpingSearchString: String
    var statistics: ChineseWordStatistics?

    var displayHeadword: String {
        joinedUnique([traditional, simplified], separator: " / ")
    }

    var displayReading: String {
        joinedUnique([displayPinyin, displayJyutping], separator: " · ")
    }

    private var displayPinyin: String {
        let fromItems = firstPronunciation(items.map(\.pinyin))
        if !fromItems.isEmpty { return fromItems }
        return firstSearchToken(pinyinSearchString)
    }

    private var displayJyutping: String {
        let fromItems = firstPronunciation(items.map(\.jyutping))
        if !fromItems.isEmpty { return fromItems }
        return firstPronunciation([jyutpingSearchString])
    }

    private func firstPronunciation(_ values: [String]) -> String {
        for value in values {
            let candidates = value
                .components(separatedBy: CharacterSet(charactersIn: "/,;，、\n\t"))
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if let first = candidates.first {
                return first
            }
        }
        return ""
    }

    private func firstSearchToken(_ value: String) -> String {
        value
            .components(separatedBy: CharacterSet(charactersIn: "/,;，、 \n\t"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? ""
    }

    var allDefinitions: [String] {
        uniqueNonEmpty(items.flatMap(\.definitions) + [gloss])
    }
}

struct ChineseWordItem: Identifiable, Hashable {
    var source: String
    var pinyin: String
    var jyutping: String
    var simplifiedTraditional: String
    var definitions: [String]
    var tang: [String]
    var variantRefs: [String]

    var id: String {
        joinedUnique([source, pinyin, jyutping, simplifiedTraditional] + definitions, separator: "|")
    }
}

struct ChineseWordStatistics: Hashable {
    var movieWordRank: Int?
    var movieWordCount: Int?
    var movieWordCountPercent: Double?
    var bookWordRank: Int?
    var bookWordCount: Int?
    var bookWordCountPercent: Double?
}

struct JapaneseWordEntry: Identifiable, Hashable {
    var id: String
    var kanji: [JapaneseHeadword]
    var kana: [JapaneseHeadword]
    var senses: [JapaneseSenseSummary]

    var visibleKanji: [JapaneseHeadword] {
        kanji.filter { !$0.tags.contains("sK") }
    }

    var visibleKana: [JapaneseHeadword] {
        kana.filter { !$0.tags.contains("sk") }
    }

    var displayHeadword: String {
        let kanjiText = joinedUnique(visibleKanji.map(\.text), separator: "、")
        if !kanjiText.isEmpty { return kanjiText }
        return joinedUnique(visibleKana.map(\.text), separator: "、")
    }

    var displayReading: String {
        joinedUnique(visibleKana.map(\.text), separator: "、")
    }

    var speakText: String {
        visibleKanji.first?.text ?? visibleKana.first?.text ?? displayHeadword
    }

    var flattenedDefinitions: [String] {
        uniqueNonEmpty(senses.flatMap { sense in
            sense.glosses.map(\.text) + sense.info
        })
    }

    var flattenedTags: [String] {
        var values: [String] = []
        for sense in senses {
            values.append(contentsOf: sense.partOfSpeech)
            values.append(contentsOf: sense.misc)
            values.append(contentsOf: sense.field)
            values.append(contentsOf: sense.dialect)
        }
        values.append(contentsOf: visibleKanji.flatMap(\.tags))
        values.append(contentsOf: visibleKana.flatMap(\.tags))
        if visibleKanji.contains(where: \.isCommon) || visibleKana.contains(where: \.isCommon) {
            values.append("common")
        }
        return uniqueNonEmpty(values)
    }

    var flattenedExamples: [SentenceExample] {
        uniqueSentenceExamples(senses.flatMap(\.examples))
    }

    func flattenedSection() -> WordSection {
        WordSection(
            language: .ja,
            headword: displayHeadword,
            reading: displayReading,
            definitions: flattenedDefinitions.isEmpty ? ["No English gloss in local record"] : flattenedDefinitions,
            tags: flattenedTags,
            examples: Array(flattenedExamples.prefix(12))
        )
    }
}

struct JapaneseHeadword: Identifiable, Hashable {
    enum Kind: String, Hashable {
        case kanji
        case kana
    }

    var id: String { "\(kind.rawValue)-\(text)-\(tags.joined(separator: ","))" }
    var kind: Kind
    var text: String
    var isCommon: Bool
    var tags: [String]
    var appliesTo: [String]
    var pitchAccents: [Int]
}

struct JapaneseSenseSummary: Identifiable, Hashable {
    var id: String
    var partOfSpeech: [String]
    var appliesToKanji: [String]
    var appliesToKana: [String]
    var related: [JapaneseTextReference]
    var antonyms: [JapaneseTextReference]
    var field: [String]
    var dialect: [String]
    var misc: [String]
    var info: [String]
    var languageSource: [JapaneseLanguageSourceSummary]
    var glosses: [JapaneseGlossSummary]
    var examples: [SentenceExample]

    var primaryPartOfSpeech: String {
        partOfSpeech.first ?? "no-pos"
    }
}

struct JapaneseTextReference: Identifiable, Hashable {
    var text: String
    var type: String
    var id: String { "\(text)-\(type)" }
}

struct JapaneseLanguageSourceSummary: Identifiable, Hashable {
    var lang: String
    var text: String
    var isFull: Bool
    var isWasei: Bool
    var id: String { "\(lang)-\(text)-\(isFull)-\(isWasei)" }
}

struct JapaneseGlossSummary: Identifiable, Hashable {
    var lang: String
    var gender: String
    var type: String
    var text: String
    var id: String { "\(lang)-\(gender)-\(type)-\(text)" }
}

struct KoreanWordEntry: Identifiable, Hashable {
    var id: String
    var hangul: String
    var hanja: String
    var romanization: String
    var pronunciation: String
    var partOfSpeech: String
    var definitions: [KoreanDefinitionSummary]
    var examples: [KoreanExampleSummary]
    var origin: String
    var frequencyRank: Int?

    var displayHeadword: String {
        hanja.isEmpty ? hangul : "\(hangul) / \(hanja)"
    }

    var displayReading: String {
        joinedUnique([pronunciation, romanization], separator: " / ")
    }

    func flattenedSection() -> WordSection {
        let rankTags = frequencyRank.map { ["rank \($0)"] } ?? []
        return WordSection(
            language: .ko,
            headword: displayHeadword.isEmpty ? hangul : displayHeadword,
            reading: displayReading,
            definitions: definitions.map(\.text).isEmpty ? ["No English gloss in local record"] : definitions.map(\.text),
            tags: uniqueNonEmpty([partOfSpeech, origin] + rankTags),
            examples: examples.map {
                SentenceExample(language: .ko, text: $0.korean, translation: $0.translation, source: "")
            }
        )
    }
}

struct KoreanDefinitionSummary: Identifiable, Hashable {
    var text: String
    var language: String
    var senseNumber: Int?
    var id: String { "\(senseNumber.map(String.init) ?? "")-\(language)-\(text)" }
}

struct KoreanExampleSummary: Identifiable, Hashable {
    var korean: String
    var translation: String
    var id: String { "\(korean)-\(translation)" }
}

struct CharacterFact: Identifiable, Hashable {
    var label: String
    var value: String
    var id: String { "\(label)-\(value)" }
}

struct CharacterVariantSummary: Identifiable, Hashable {
    var character: String
    var label: String
    var source: String
    var id: String { "\(character)-\(label)-\(source)" }
}

struct CharacterTopWord: Identifiable, Hashable {
    var word: String
    var traditional: String
    var gloss: String
    var share: Double?
    var id: String { "\(word)-\(traditional)-\(gloss)" }
}

struct CharacterPronunciationHistory: Identifiable, Hashable {
    var pinyin: String
    var source: String
    var gloss: String
    var middleChinese: String
    var oldChinese: String
    var dynasty: String
    var id: String { "\(pinyin)-\(source)-\(middleChinese)-\(oldChinese)-\(dynasty)" }
}

struct CharacterComment: Identifiable, Hashable {
    var comment: String
    var source: String
    var id: String { "\(source)-\(comment)" }
}

struct CharacterImageReference: Identifiable, Hashable {
    var url: String
    var type: String
    var era: String
    var strokeSet: CharacterStrokeSet? = nil
    var id: String { "\(url)-\(type)-\(era)" }
}

struct JapaneseLabelLookup {
    enum Category {
        case partOfSpeech
        case misc
        case field
        case dialect
        case headInfo
        case glossType
    }

    var partOfSpeech: [String: String]
    var misc: [String: String]
    var field: [String: String]
    var dialect: [String: String]
    var headInfo: [String: String]
    var glossType: [String: String]
    var flat: [String: String]

    static let empty = JapaneseLabelLookup(
        partOfSpeech: [:],
        misc: [:],
        field: [:],
        dialect: [:],
        headInfo: [:],
        glossType: [:],
        flat: [:]
    )

    func label(_ tag: String, category: Category) -> String {
        let map: [String: String]
        switch category {
        case .partOfSpeech: map = partOfSpeech
        case .misc: map = misc
        case .field: map = field
        case .dialect: map = dialect
        case .headInfo: map = headInfo
        case .glossType: map = glossType
        }

        let candidates = normalizedCandidates(for: tag, category: category)
        for candidate in candidates {
            if let label = map[candidate] ?? flat[candidate] {
                return label
            }
        }
        return tag
    }

    func headwordInfoLabel(_ tag: String) -> String {
        label(tag, category: .headInfo)
    }

    static func decode(json: String) -> JapaneseLabelLookup {
        guard
            let data = json.data(using: .utf8),
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return .empty }

        let labels = root["labels"] as? [String: Any] ?? root
        let pos = stringMap(labels["pos"] ?? labels["partOfSpeech"])
        let misc = stringMap(labels["misc"])
        let field = stringMap(labels["field"])
        let dialect = stringMap(labels["dial"] ?? labels["dialect"])
        let headInfo = stringMap(labels["head_info"] ?? labels["headInfo"] ?? labels["tag"])
        let glossType = stringMap(labels["glossType"] ?? labels["gloss_type"])
        let explicitFlat = stringMap(root["flatLabels"])

        var flat = explicitFlat
        for map in [pos, misc, field, dialect, headInfo, glossType] {
            for (key, value) in map where flat[key] == nil {
                flat[key] = value
            }
        }

        return JapaneseLabelLookup(
            partOfSpeech: pos,
            misc: misc,
            field: field,
            dialect: dialect,
            headInfo: headInfo,
            glossType: glossType,
            flat: flat
        )
    }

    private func normalizedCandidates(for tag: String, category: Category) -> [String] {
        var candidates = [
            tag,
            tag.replacingOccurrences(of: "-", with: "_"),
            tag.replacingOccurrences(of: "_", with: "-")
        ]
        if category == .headInfo {
            let mapped: [String: String] = [
                "iK": "ikanji",
                "ik": "ikana",
                "oK": "okanji",
                "ok": "okana",
                "rK": "rkanji",
                "rk": "rkana",
                "sK": "ikanji",
                "sk": "ikana"
            ]
            if let value = mapped[tag] {
                candidates.append(value)
            }
        }
        var seen = Set<String>()
        return candidates.filter { !$0.isEmpty && seen.insert($0).inserted }
    }

    private static func stringMap(_ value: Any?) -> [String: String] {
        guard let object = value as? [String: Any] else { return [:] }
        var output: [String: String] = [:]
        for (key, value) in object {
            switch value {
            case let string as String:
                output[key] = string
            case let number as NSNumber:
                output[key] = number.stringValue
            default:
                break
            }
        }
        return output
    }
}

private func uniqueNonEmpty(_ values: [String]) -> [String] {
    var seen = Set<String>()
    var output: [String] = []
    for value in values.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !value.isEmpty {
        if seen.insert(value).inserted {
            output.append(value)
        }
    }
    return output
}

private func joinedUnique(_ values: [String], separator: String) -> String {
    uniqueNonEmpty(values).joined(separator: separator)
}

private func uniqueSentenceExamples(_ values: [SentenceExample]) -> [SentenceExample] {
    var seen = Set<String>()
    var output: [SentenceExample] = []
    for value in values where !value.text.isEmpty {
        let key = "\(value.language.rawValue)-\(value.text)-\(value.translation)"
        if seen.insert(key).inserted {
            output.append(value)
        }
    }
    return output
}

private extension Bool {
    func mapToArray<T>(_ value: T) -> [T] {
        self ? [value] : []
    }
}

enum JapaneseVerbType: String, CaseIterable, Hashable {
    case v1
    case v1S = "v1_s"
    case v5u
    case v5k
    case v5kS = "v5k_s"
    case v5g
    case v5s
    case v5t
    case v5n
    case v5b
    case v5m
    case v5r
    case v5rI = "v5r_i"
    case v5aru
    case v5uru
    case vk
    case vsI = "vs_i"
    case vsS = "vs_s"
    case vz

    init?(posTag: String) {
        let normalized = posTag
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "-", with: "_")
        if let exact = Self(rawValue: normalized) {
            self = exact
            return
        }
        if normalized.contains("ichidan") {
            self = .v1
            return
        }
        if normalized.contains("kuru") {
            self = .vk
            return
        }
        if normalized.contains("suru") {
            self = .vsI
            return
        }
        if normalized.contains("godan") {
            if normalized.contains("ku") { self = .v5k; return }
            if normalized.contains("gu") { self = .v5g; return }
            if normalized.contains("su") { self = .v5s; return }
            if normalized.contains("tsu") { self = .v5t; return }
            if normalized.contains("nu") { self = .v5n; return }
            if normalized.contains("bu") { self = .v5b; return }
            if normalized.contains("mu") { self = .v5m; return }
            if normalized.contains("ru") { self = .v5r; return }
            if normalized.contains("u") { self = .v5u; return }
        }
        return nil
    }

    var displayLabel: String {
        switch self {
        case .v1: "Ichidan verb"
        case .v1S: "Ichidan verb (kureru)"
        case .v5u: "Godan verb (-u)"
        case .v5k: "Godan verb (-ku)"
        case .v5kS: "Godan verb (iku/yuku)"
        case .v5g: "Godan verb (-gu)"
        case .v5s: "Godan verb (-su)"
        case .v5t: "Godan verb (-tsu)"
        case .v5n: "Godan verb (-nu)"
        case .v5b: "Godan verb (-bu)"
        case .v5m: "Godan verb (-mu)"
        case .v5r: "Godan verb (-ru)"
        case .v5rI: "Godan verb (-ru irregular)"
        case .v5aru: "Godan verb (-aru)"
        case .v5uru: "Godan verb (-uru)"
        case .vk: "Kuru verb"
        case .vsI: "Suru verb"
        case .vsS: "Suru verb (special)"
        case .vz: "Ichidan verb (-zuru)"
        }
    }
}

struct JapaneseConjugationForm: Identifiable, Hashable {
    var form: String
    var label: String
    var category: String

    var id: String { "\(category)-\(label)-\(form)" }
}

struct JapaneseConjugationTable: Hashable {
    var dictionary: String
    var verbType: JapaneseVerbType
    var forms: [JapaneseConjugationForm]

    static let categoryOrder = ["basic", "negative", "past", "te", "conditional", "volitional", "imperative", "voice", "desire", "auxiliary"]

    static func categoryTitle(_ category: String) -> String {
        switch category {
        case "basic": "Basic"
        case "negative": "Negative"
        case "past": "Past"
        case "te": "Te-form"
        case "conditional": "Conditional"
        case "volitional": "Volitional"
        case "imperative": "Imperative"
        case "voice": "Voice"
        case "desire": "Desire"
        case "auxiliary": "Auxiliary"
        default: category.capitalized
        }
    }

    func forms(in category: String) -> [JapaneseConjugationForm] {
        forms.filter { $0.category == category }
    }
}

enum JapaneseConjugator {
    private struct GodanPattern {
        var a: String
        var i: String
        var u: String
        var e: String
        var o: String
        var te: String
        var ta: String
    }

    static func verbType(from tags: [String]) -> JapaneseVerbType? {
        tags.lazy.compactMap(JapaneseVerbType.init(posTag:)).first
    }

    static func table(for section: WordSection) -> JapaneseConjugationTable? {
        guard section.language == .ja else { return nil }
        let dictionary = primaryDictionaryForm(from: section.headword, fallback: section.reading)
        guard !dictionary.isEmpty, let type = verbType(from: section.tags) else { return nil }
        return conjugate(dictionary, type: type)
    }

    static func conjugate(_ verb: String, type: JapaneseVerbType) -> JapaneseConjugationTable {
        let stem = stem(for: verb, type: type)
        var forms: [JapaneseConjugationForm] = []

        func add(_ form: String, _ label: String, _ category: String) {
            forms.append(JapaneseConjugationForm(form: form, label: label, category: category))
        }

        switch type {
        case .v1, .v1S, .vz:
            add(verb, "Dictionary", "basic")
            add(stem + "ます", "Polite", "basic")
            add(stem + "ない", "Negative", "negative")
            add(stem + "ません", "Polite Negative", "negative")
            add(stem + "た", "Past", "past")
            add(stem + "ました", "Polite Past", "past")
            add(stem + "なかった", "Past Negative", "past")
            add(stem + "ませんでした", "Polite Past Negative", "past")
            add(stem + "て", "Te-form", "te")
            add(stem + "ないで", "Negative Te-form", "te")
            add(stem + "たら", "Conditional (-tara)", "conditional")
            add(stem + "れば", "Conditional (-ba)", "conditional")
            add(stem + "よう", "Volitional", "volitional")
            add(stem + "ましょう", "Polite Volitional", "volitional")
            add(stem + "ろ", "Imperative", "imperative")
            add(stem + "るな", "Imperative Negative", "imperative")
            add(stem + "られる", "Potential", "voice")
            add(stem + "られる", "Passive", "voice")
            add(stem + "させる", "Causative", "voice")
            add(stem + "させられる", "Causative Passive", "voice")
            add(stem + "たい", "Want to (-tai)", "desire")
            add(stem + "そう", "Seems like (-sou)", "auxiliary")
            add(stem + "すぎる", "Too much (-sugiru)", "auxiliary")
        case .vk:
            let ki = verb.hasSuffix("来る") ? "来" : "き"
            let ko = verb.hasSuffix("来る") ? "来" : "こ"
            add(verb, "Dictionary", "basic")
            add(stem + ki + "ます", "Polite", "basic")
            add(stem + ko + "ない", "Negative", "negative")
            add(stem + ki + "ません", "Polite Negative", "negative")
            add(stem + ki + "た", "Past", "past")
            add(stem + ki + "ました", "Polite Past", "past")
            add(stem + ko + "なかった", "Past Negative", "past")
            add(stem + ki + "ませんでした", "Polite Past Negative", "past")
            add(stem + ki + "て", "Te-form", "te")
            add(stem + ko + "ないで", "Negative Te-form", "te")
            add(stem + ki + "たら", "Conditional (-tara)", "conditional")
            add(stem + ko + "よう", "Volitional", "volitional")
            add(stem + ki + "ましょう", "Polite Volitional", "volitional")
            add(stem + ko + "い", "Imperative", "imperative")
            add(stem + ko + "られる", "Potential", "voice")
            add(stem + ko + "られる", "Passive", "voice")
            add(stem + ko + "させる", "Causative", "voice")
        case .vsI, .vsS:
            add(verb, "Dictionary", "basic")
            add(stem + "します", "Polite", "basic")
            add(stem + "しない", "Negative", "negative")
            add(stem + "しません", "Polite Negative", "negative")
            add(stem + "した", "Past", "past")
            add(stem + "しました", "Polite Past", "past")
            add(stem + "しなかった", "Past Negative", "past")
            add(stem + "しませんでした", "Polite Past Negative", "past")
            add(stem + "して", "Te-form", "te")
            add(stem + "しないで", "Negative Te-form", "te")
            add(stem + "したら", "Conditional (-tara)", "conditional")
            add(stem + "すれば", "Conditional (-ba)", "conditional")
            add(stem + "しよう", "Volitional", "volitional")
            add(stem + "しましょう", "Polite Volitional", "volitional")
            add(stem + "しろ", "Imperative", "imperative")
            add(stem + "するな", "Imperative Negative", "imperative")
            add(stem + "できる", "Potential", "voice")
            add(stem + "される", "Passive", "voice")
            add(stem + "させる", "Causative", "voice")
            add(stem + "したい", "Want to (-tai)", "desire")
        default:
            if let pattern = godanPattern(for: type) {
                add(verb, "Dictionary", "basic")
                add(stem + pattern.i + "ます", "Polite", "basic")
                add(stem + pattern.a + "ない", "Negative", "negative")
                add(stem + pattern.i + "ません", "Polite Negative", "negative")
                add(stem + pattern.ta, "Past", "past")
                add(stem + pattern.i + "ました", "Polite Past", "past")
                add(stem + pattern.a + "なかった", "Past Negative", "past")
                add(stem + pattern.i + "ませんでした", "Polite Past Negative", "past")
                add(stem + pattern.te, "Te-form", "te")
                add(stem + pattern.a + "ないで", "Negative Te-form", "te")
                add(stem + pattern.ta + "ら", "Conditional (-tara)", "conditional")
                add(stem + pattern.e + "ば", "Conditional (-ba)", "conditional")
                add(stem + pattern.o + "う", "Volitional", "volitional")
                add(stem + pattern.i + "ましょう", "Polite Volitional", "volitional")
                add(stem + pattern.e, "Imperative", "imperative")
                add(stem + pattern.u + "な", "Imperative Negative", "imperative")
                add(stem + pattern.e + "る", "Potential", "voice")
                add(stem + pattern.a + "れる", "Passive", "voice")
                add(stem + pattern.a + "せる", "Causative", "voice")
                add(stem + pattern.a + "せられる", "Causative Passive", "voice")
                add(stem + pattern.i + "たい", "Want to (-tai)", "desire")
                add(stem + pattern.i + "そう", "Seems like (-sou)", "auxiliary")
                add(stem + pattern.i + "すぎる", "Too much (-sugiru)", "auxiliary")
            }
        }

        return JapaneseConjugationTable(dictionary: verb, verbType: type, forms: forms)
    }

    private static func primaryDictionaryForm(from headword: String, fallback: String) -> String {
        let candidate = headword
            .components(separatedBy: CharacterSet(charactersIn: "、/;，,\n\t"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? ""
        if !candidate.isEmpty { return candidate }
        return fallback
            .components(separatedBy: CharacterSet(charactersIn: "、/;，,\n\t"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? ""
    }

    private static func stem(for verb: String, type: JapaneseVerbType) -> String {
        switch type {
        case .v1, .v1S, .vz:
            return String(verb.dropLast())
        case .vk:
            return String(verb.dropLast(min(2, verb.count)))
        case .vsI, .vsS:
            if verb.hasSuffix("する") || verb.hasSuffix("ずる") {
                return String(verb.dropLast(2))
            }
            return verb
        default:
            return String(verb.dropLast())
        }
    }

    private static func godanPattern(for type: JapaneseVerbType) -> GodanPattern? {
        switch type {
        case .v5u:
            return GodanPattern(a: "わ", i: "い", u: "う", e: "え", o: "お", te: "って", ta: "った")
        case .v5k:
            return GodanPattern(a: "か", i: "き", u: "く", e: "け", o: "こ", te: "いて", ta: "いた")
        case .v5kS:
            return GodanPattern(a: "か", i: "き", u: "く", e: "け", o: "こ", te: "って", ta: "った")
        case .v5g:
            return GodanPattern(a: "が", i: "ぎ", u: "ぐ", e: "げ", o: "ご", te: "いで", ta: "いだ")
        case .v5s:
            return GodanPattern(a: "さ", i: "し", u: "す", e: "せ", o: "そ", te: "して", ta: "した")
        case .v5t:
            return GodanPattern(a: "た", i: "ち", u: "つ", e: "て", o: "と", te: "って", ta: "った")
        case .v5n:
            return GodanPattern(a: "な", i: "に", u: "ぬ", e: "ね", o: "の", te: "んで", ta: "んだ")
        case .v5b:
            return GodanPattern(a: "ば", i: "び", u: "ぶ", e: "べ", o: "ぼ", te: "んで", ta: "んだ")
        case .v5m:
            return GodanPattern(a: "ま", i: "み", u: "む", e: "め", o: "も", te: "んで", ta: "んだ")
        case .v5r, .v5rI, .v5aru, .v5uru:
            return GodanPattern(a: "ら", i: "り", u: "る", e: "れ", o: "ろ", te: "って", ta: "った")
        default:
            return nil
        }
    }
}

struct SentenceExample: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(text)-\(translation)" }
    var language: LanguageCode
    var text: String
    var translation: String
    var source: String
}

struct StaticSentenceExample: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(text)-\(alternateText)-\(translation)" }
    var language: LanguageCode
    var text: String
    var alternateText: String
    var translation: String
    var reading: String
    var source: String
}

struct PitchAccentPattern: Identifiable, Hashable {
    var id: String { "\(word)-\(reading)-\(accent)" }
    var word: String
    var reading: String
    var accent: Int

    var displayReading: String {
        reading.isEmpty ? word : reading
    }

    var morae: [String] {
        Self.morae(from: displayReading)
    }

    var label: String {
        let count = morae.count
        if accent == 0 { return "平板" }
        if accent == 1 { return "頭高" }
        if accent == count { return "尾高" }
        return "中高"
    }

    func isHighMora(at index: Int) -> Bool {
        if accent == 0 { return index > 0 }
        if accent == 1 { return index == 0 }
        return index > 0 && index < accent
    }

    private static func morae(from kana: String) -> [String] {
        let smallKana = Set("ゃゅょャュョぁぃぅぇぉァィゥェォ")
        let characters = Array(kana)
        var output: [String] = []
        var index = 0
        while index < characters.count {
            let current = characters[index]
            if index + 1 < characters.count {
                let next = characters[index + 1]
                if smallKana.contains(next) || next == "ー" {
                    output.append(String(current) + String(next))
                    index += 2
                    continue
                }
            }
            output.append(String(current))
            index += 1
        }
        return output
    }
}

struct UserNote: Identifiable, Hashable {
    var id: String
    var userId: String
    var character: String
    var noteText: String
    var isAdmin: Bool
    var createdAt: Date
    var updatedAt: Date
    var dirty: Bool
    var deleted: Bool
}

struct EntryNote: Identifiable, Hashable {
    var id: String
    var userId: String
    var character: String
    var noteText: String
    var isAdmin: Bool
    var createdAt: Date
    var updatedAt: Date
    var dirty: Bool
    var userName: String
    var userImage: String?

    var isLocalUser: Bool {
        userId == LocalDatabase.currentUserId
    }

    var displayName: String {
        if isLocalUser { return "You" }
        if !userName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return userName }
        if isAdmin { return "Kiokun" }
        return "Community note"
    }

    init(localNote: UserNote) {
        id = localNote.id
        userId = localNote.userId
        character = localNote.character
        noteText = localNote.noteText
        isAdmin = localNote.isAdmin
        createdAt = localNote.createdAt
        updatedAt = localNote.updatedAt
        dirty = localNote.dirty
        userName = localNote.userId == LocalDatabase.currentUserId ? LocalDatabase.currentUserName : ""
        userImage = nil
    }

    init(remoteNote: RemoteEntryNote) {
        id = remoteNote.id
        userId = remoteNote.userId
        character = remoteNote.character
        noteText = remoteNote.noteText
        isAdmin = remoteNote.isAdmin
        createdAt = Date(timeIntervalSince1970: Double(remoteNote.createdAt) / 1000.0)
        updatedAt = Date(timeIntervalSince1970: Double(remoteNote.updatedAt) / 1000.0)
        dirty = false
        userName = remoteNote.user?.name ?? ""
        userImage = remoteNote.user?.image
    }

    static func uniqued(_ notes: [EntryNote]) -> [EntryNote] {
        var seen = Set<String>()
        var output: [EntryNote] = []
        let sorted = notes.sorted { lhs, rhs in
            if lhs.isLocalUser != rhs.isLocalUser { return lhs.isLocalUser }
            if lhs.isAdmin != rhs.isAdmin { return lhs.isAdmin }
            return lhs.updatedAt > rhs.updatedAt
        }
        for note in sorted {
            let key = note.id.isEmpty ? "\(note.userId)|\(note.character)" : note.id
            guard seen.insert(key).inserted else { continue }
            guard !note.noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            output.append(note)
        }
        return output
    }
}

struct StudyCard: Identifiable, Hashable {
    var id: String
    var userId: String
    var word: String
    var language: LanguageCode
    var easeFactor: Int
    var interval: Int
    var repetitions: Int
    var nextReview: Date
    var lastReviewed: Date?
    var createdAt: Date
    var updatedAt: Date
    var dirty: Bool

    var isDue: Bool {
        Calendar.current.startOfDay(for: nextReview) <= Calendar.current.startOfDay(for: Date())
    }
}

enum ReviewRating: String, CaseIterable, Identifiable {
    case again
    case hard
    case good
    case easy

    var id: String { rawValue }

    var title: String {
        switch self {
        case .again: "Again"
        case .hard: "Hard"
        case .good: "Good"
        case .easy: "Easy"
        }
    }

    var quality: Int {
        switch self {
        case .again: 0
        case .hard: 2
        case .good: 4
        case .easy: 5
        }
    }
}

struct StudyStats {
    var totalCards: Int
    var dueToday: Int
    var dueThisWeek: Int
    var cardsNew: Int
    var cardsLearning: Int
    var cardsMature: Int
    var averageEase: Double

    init(cards: [StudyCard]) {
        let today = Calendar.current.startOfDay(for: Date())
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: today) ?? today
        let nextWeek = Calendar.current.date(byAdding: .day, value: 7, to: today) ?? today
        totalCards = cards.count
        dueToday = cards.filter { $0.nextReview < tomorrow }.count
        dueThisWeek = cards.filter { $0.nextReview < nextWeek }.count
        cardsNew = cards.filter { $0.repetitions == 0 }.count
        cardsLearning = cards.filter { $0.repetitions > 0 && $0.interval < 21 }.count
        cardsMature = cards.filter { $0.interval >= 21 }.count
        averageEase = cards.isEmpty ? 2.5 : Double(cards.map(\.easeFactor).reduce(0, +)) / Double(cards.count) / 100.0
    }
}

struct CustomWord: Identifiable, Hashable {
    var id: String
    var userId: String
    var word: String
    var language: LanguageCode
    var reading: String
    var definitions: [String]
    var notes: String
    var createdAt: Date
    var updatedAt: Date
    var dirty: Bool
}

struct CustomWordDraft {
    var word = ""
    var language: LanguageCode = .ja
    var reading = ""
    var definitions = ""
    var notes = ""
}

struct Artifact: Identifiable, Hashable {
    var id: String
    var userId: String
    var title: String
    var description: String
    var language: LanguageCode
    var type: String
    var isPublic: Bool
    var thumbnailPath: String?
    var sentenceCount: Int
    var createdAt: Date
    var updatedAt: Date
    var dirty: Bool
}

struct ArtifactImage: Identifiable, Hashable {
    var id: String
    var artifactId: String
    var imagePath: String
    var sortOrder: Int
    var createdAt: Date
}

struct ArtifactDraft {
    var title = ""
    var description = ""
    var language: LanguageCode = .ja
    var type = "other"
    var isPublic = true
}

struct ArtifactSentence: Identifiable, Hashable {
    var id: String
    var artifactId: String
    var originalText: String
    var translation: String
    var sortOrder: Int
    var createdAt: Date
}

struct ArtifactMention: Identifiable, Hashable {
    var artifact: Artifact
    var sentences: [ArtifactSentence]

    var id: String { artifact.id }
}

struct SyncTask: Identifiable, Hashable {
    var id: String
    var entity: String
    var entityId: String
    var operation: String
    var payload: String
    var attempts: Int
    var lastError: String
    var createdAt: Date
}

struct SyncAppliedResult: Decodable {
    var id: String
    var status: String
    var reason: String?
}

struct SyncPushResponse: Decodable {
    var success: Bool
    var applied: [SyncAppliedResult]
    var serverTime: Int64

    private enum CodingKeys: String, CodingKey {
        case success
        case applied
        case serverTime
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        success = (try? container.decode(Bool.self, forKey: .success)) ?? false
        applied = (try? container.decode([SyncAppliedResult].self, forKey: .applied)) ?? []
        serverTime = container.decodeFlexibleInt64(forKey: .serverTime) ?? LocalDatabase.nowMillis()
    }
}

struct CloudflarePullPayload: Decodable {
    var serverTime: Int64
    var notes: [RemoteNote]
    var studyCards: [RemoteStudyCard]
    var customWords: [RemoteCustomWord]
    var artifacts: [RemoteArtifact]
    var artifactImages: [RemoteArtifactImage]
    var artifactSentences: [RemoteArtifactSentence]
    var tombstones: [RemoteTombstone]

    private enum CodingKeys: String, CodingKey {
        case serverTime
        case notes
        case studyCards
        case customWords
        case artifacts
        case artifactImages
        case artifactSentences
        case tombstones
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        serverTime = container.decodeFlexibleInt64(forKey: .serverTime) ?? LocalDatabase.nowMillis()
        notes = (try? container.decode([RemoteNote].self, forKey: .notes)) ?? []
        studyCards = (try? container.decode([RemoteStudyCard].self, forKey: .studyCards)) ?? []
        customWords = (try? container.decode([RemoteCustomWord].self, forKey: .customWords)) ?? []
        artifacts = (try? container.decode([RemoteArtifact].self, forKey: .artifacts)) ?? []
        artifactImages = (try? container.decode([RemoteArtifactImage].self, forKey: .artifactImages)) ?? []
        artifactSentences = (try? container.decode([RemoteArtifactSentence].self, forKey: .artifactSentences)) ?? []
        tombstones = (try? container.decode([RemoteTombstone].self, forKey: .tombstones)) ?? []
    }
}

struct RemoteNote: Decodable {
    var id: String
    var character: String
    var noteText: String
    var isAdmin: Bool
    var createdAt: Int64
    var updatedAt: Int64

    private enum CodingKeys: String, CodingKey {
        case id
        case character
        case noteText
        case isAdmin
        case createdAt
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        character = container.decodeFlexibleString(forKey: .character)
        noteText = container.decodeFlexibleString(forKey: .noteText)
        isAdmin = container.decodeFlexibleBool(forKey: .isAdmin)
        createdAt = container.decodeFlexibleInt64(forKey: .createdAt) ?? LocalDatabase.nowMillis()
        updatedAt = container.decodeFlexibleInt64(forKey: .updatedAt) ?? createdAt
    }
}

struct RemoteEntryNoteUser: Decodable, Hashable {
    var id: String
    var name: String
    var image: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case image
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        name = container.decodeFlexibleString(forKey: .name)
        image = {
            let value = container.decodeFlexibleString(forKey: .image)
            return value.isEmpty ? nil : value
        }()
    }
}

struct RemoteEntryNote: Decodable, Hashable {
    var id: String
    var userId: String
    var character: String
    var noteText: String
    var isAdmin: Bool
    var createdAt: Int64
    var updatedAt: Int64
    var user: RemoteEntryNoteUser?

    private enum CodingKeys: String, CodingKey {
        case id
        case userId
        case character
        case noteText
        case isAdmin
        case createdAt
        case updatedAt
        case user
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        userId = container.decodeFlexibleString(forKey: .userId)
        character = container.decodeFlexibleString(forKey: .character)
        noteText = container.decodeFlexibleString(forKey: .noteText)
        isAdmin = container.decodeFlexibleBool(forKey: .isAdmin)
        createdAt = container.decodeFlexibleInt64(forKey: .createdAt) ?? LocalDatabase.nowMillis()
        updatedAt = container.decodeFlexibleInt64(forKey: .updatedAt) ?? createdAt
        user = try? container.decodeIfPresent(RemoteEntryNoteUser.self, forKey: .user)
    }
}

struct RemoteStudyCard: Decodable {
    var id: String
    var word: String
    var language: String
    var easeFactor: Int64
    var interval: Int64
    var repetitions: Int64
    var nextReview: Int64
    var lastReviewed: Int64?
    var createdAt: Int64
    var updatedAt: Int64

    private enum CodingKeys: String, CodingKey {
        case id
        case word
        case language
        case easeFactor
        case interval
        case repetitions
        case nextReview
        case lastReviewed
        case createdAt
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        word = container.decodeFlexibleString(forKey: .word)
        language = container.decodeFlexibleString(forKey: .language)
        easeFactor = container.decodeFlexibleInt64(forKey: .easeFactor) ?? 250
        interval = container.decodeFlexibleInt64(forKey: .interval) ?? 0
        repetitions = container.decodeFlexibleInt64(forKey: .repetitions) ?? 0
        nextReview = container.decodeFlexibleInt64(forKey: .nextReview) ?? LocalDatabase.nowMillis()
        lastReviewed = container.decodeFlexibleInt64(forKey: .lastReviewed)
        createdAt = container.decodeFlexibleInt64(forKey: .createdAt) ?? LocalDatabase.nowMillis()
        updatedAt = container.decodeFlexibleInt64(forKey: .updatedAt) ?? createdAt
    }
}

struct RemoteCustomWord: Decodable {
    var id: String
    var word: String
    var language: String
    var reading: String
    var definitions: String
    var notes: String
    var createdAt: Int64
    var updatedAt: Int64

    private enum CodingKeys: String, CodingKey {
        case id
        case word
        case language
        case pinyin
        case jyutping
        case kana
        case hangul
        case definitions
        case notes
        case createdAt
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        word = container.decodeFlexibleString(forKey: .word)
        language = container.decodeFlexibleString(forKey: .language)
        reading = [
            container.decodeFlexibleString(forKey: .kana),
            container.decodeFlexibleString(forKey: .pinyin),
            container.decodeFlexibleString(forKey: .jyutping),
            container.decodeFlexibleString(forKey: .hangul)
        ].first(where: { !$0.isEmpty }) ?? ""
        definitions = container.decodeFlexibleString(forKey: .definitions)
        notes = container.decodeFlexibleString(forKey: .notes)
        createdAt = container.decodeFlexibleInt64(forKey: .createdAt) ?? LocalDatabase.nowMillis()
        updatedAt = container.decodeFlexibleInt64(forKey: .updatedAt) ?? createdAt
    }
}

struct RemoteArtifact: Decodable {
    var id: String
    var title: String
    var description: String
    var language: String
    var type: String
    var isPublic: Bool
    var createdAt: Int64
    var updatedAt: Int64

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case language
        case type
        case isPublic
        case createdAt
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        title = container.decodeFlexibleString(forKey: .title)
        description = container.decodeFlexibleString(forKey: .description)
        language = container.decodeFlexibleString(forKey: .language)
        type = container.decodeFlexibleString(forKey: .type)
        isPublic = container.decodeFlexibleBool(forKey: .isPublic)
        createdAt = container.decodeFlexibleInt64(forKey: .createdAt) ?? LocalDatabase.nowMillis()
        updatedAt = container.decodeFlexibleInt64(forKey: .updatedAt) ?? createdAt
    }
}

struct RemoteArtifactImage: Decodable {
    var id: String
    var artifactId: String
    var imageUrl: String
    var sortOrder: Int64
    var createdAt: Int64

    private enum CodingKeys: String, CodingKey {
        case id
        case artifactId
        case imageUrl
        case sortOrder
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        artifactId = container.decodeFlexibleString(forKey: .artifactId)
        imageUrl = container.decodeFlexibleString(forKey: .imageUrl)
        sortOrder = container.decodeFlexibleInt64(forKey: .sortOrder) ?? 0
        createdAt = container.decodeFlexibleInt64(forKey: .createdAt) ?? LocalDatabase.nowMillis()
    }
}

struct RemoteArtifactSentence: Decodable {
    var id: String
    var artifactId: String
    var imageId: String
    var originalText: String
    var translation: String
    var sortOrder: Int64
    var createdAt: Int64

    private enum CodingKeys: String, CodingKey {
        case id
        case artifactId
        case imageId
        case originalText
        case translation
        case sortOrder
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeFlexibleString(forKey: .id)
        artifactId = container.decodeFlexibleString(forKey: .artifactId)
        imageId = container.decodeFlexibleString(forKey: .imageId)
        originalText = container.decodeFlexibleString(forKey: .originalText)
        translation = container.decodeFlexibleString(forKey: .translation)
        sortOrder = container.decodeFlexibleInt64(forKey: .sortOrder) ?? 0
        createdAt = container.decodeFlexibleInt64(forKey: .createdAt) ?? LocalDatabase.nowMillis()
    }
}

struct RemoteTombstone: Decodable {
    var entity: String
    var entityId: String
    var deletedAt: Int64

    private enum CodingKeys: String, CodingKey {
        case entity
        case entityId
        case deletedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        entity = container.decodeFlexibleString(forKey: .entity)
        entityId = container.decodeFlexibleString(forKey: .entityId)
        deletedAt = container.decodeFlexibleInt64(forKey: .deletedAt) ?? LocalDatabase.nowMillis()
    }
}

struct StaticAssetSummary: Identifiable, Hashable {
    var id: String { path }
    var path: String
    var sourceBytes: Int
    var compressedBytes: Int

    var compressionRatio: Double {
        guard sourceBytes > 0 else { return 0 }
        return Double(compressedBytes) / Double(sourceBytes)
    }
}

enum GameLanguage: String, CaseIterable, Identifiable, Codable {
    case ja
    case zh
    case ko
    case tr

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ja: "Japanese"
        case .zh: "Chinese"
        case .ko: "Korean"
        case .tr: "Turkish"
        }
    }

    var nativeTitle: String {
        switch self {
        case .ja: "日本語"
        case .zh: "中文"
        case .ko: "한국어"
        case .tr: "Türkçe"
        }
    }
}

enum HomophoneMode: String, CaseIterable, Identifiable, Codable {
    case words
    case characters

    var id: String { rawValue }

    var title: String {
        switch self {
        case .words: "Words"
        case .characters: "Characters"
        }
    }
}

struct HomophoneEntry: Identifiable, Hashable {
    var id: String { "\(word)-\(reading)-\(pinyin)-\(glosses.joined(separator: "|"))" }
    var word: String
    var reading: String
    var glosses: [String]
    var pinyin: String
    var hangul: String
    var isCommon: Bool
    var partsOfSpeech: [String]
    var accent: Int?

    var definition: String {
        glosses.prefix(3).joined(separator: "; ")
    }

    var searchText: String {
        ([word, reading, pinyin, hangul] + glosses + partsOfSpeech)
            .joined(separator: " ")
            .lowercased()
    }
}

struct HomophoneGroup: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(mode.rawValue)-\(reading)" }
    var language: GameLanguage
    var mode: HomophoneMode
    var reading: String
    var displayReading: String
    var entries: [HomophoneEntry]

    var countLabel: String {
        let noun: String
        if language == .ko || mode == .characters {
            noun = entries.count == 1 ? "character" : "characters"
        } else {
            noun = entries.count == 1 ? "word" : "words"
        }
        return "\(entries.count) \(noun)"
    }
}

struct FrequencyEntry: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(rank)-\(word)" }
    var language: GameLanguage
    var rank: Int
    var word: String
    var reading: String
    var definition: String
    var isCommon: Bool

    var searchText: String {
        "\(rank) \(word) \(reading) \(definition)".lowercased()
    }
}

struct ReelVideo: Identifiable, Hashable {
    var id: String { videoId }
    var videoId: String
    var language: GameLanguage
    var url: String
    var thumbnail: String
    var wordCount: Int
    var sourceUrl: String
    var author: String
    var caption: String
    var duration: Double?
    var sampleWord: String

    var title: String {
        if !caption.isEmpty { return caption }
        if !author.isEmpty { return author }
        return videoId
    }
}

struct ReelOccurrence: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(videoId)-\(startTime)-\(sentence)" }
    var language: GameLanguage
    var word: String
    var videoId: String
    var startTime: Double
    var endTime: Double
    var sentence: String
    var video: ReelVideo?
}

struct ReelTranscriptSegment: Identifiable, Hashable {
    var id: String { "\(startTime)-\(endTime)-\(sentence)" }
    var startTime: Double
    var endTime: Double
    var sentence: String
    var words: [String]
    var confidence: Double?
}

struct ReelDetail: Identifiable, Hashable {
    var id: String { video.videoId }
    var video: ReelVideo
    var transcript: [ReelTranscriptSegment]
}

struct GameTile: Identifiable, Hashable, Codable {
    var id: Int
    var text: String
}

struct GameLanguageExercise: Hashable, Codable {
    var text: String
    var tokens: [String]
    var tiles: [GameTile]
    var numCorrectTiles: Int
}

struct GameExercise: Identifiable, Hashable {
    var id: Int { exerciseId }
    var exerciseId: Int
    var sourceId: Int
    var english: String
    var exercises: [GameLanguage: GameLanguageExercise]
}

private struct GameManifestPayload: Decodable {
    var total: Int
    var chunks: Int
    var chunk_size: Int
    var languages: [String]
}

private struct GameSentencePayload: Decodable {
    var id: Int
    var en: String
    var translations: [String: GameTranslationPayload]
}

private struct GameTranslationPayload: Decodable {
    var text: String
    var tokens: [String]
}

enum SQLiteValue {
    case text(String)
    case int(Int64)
    case double(Double)
    case blob(Data)
    case null
}

extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

extension KeyedDecodingContainer {
    func decodeFlexibleString(forKey key: Key) -> String {
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Int64.self, forKey: key) {
            return String(value)
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return String(value)
        }
        if let value = try? decodeIfPresent(Double.self, forKey: key) {
            return String(value)
        }
        if let value = try? decodeIfPresent(Bool.self, forKey: key) {
            return value ? "true" : "false"
        }
        return ""
    }

    func decodeFlexibleInt64(forKey key: Key) -> Int64? {
        if let value = try? decodeIfPresent(Int64.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return Int64(value)
        }
        if let value = try? decodeIfPresent(Double.self, forKey: key) {
            return Int64(value)
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            if let integer = Int64(value) {
                return integer
            }
            if let double = Double(value) {
                return Int64(double)
            }
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: value) {
                return LocalDatabase.millis(from: date)
            }
        }
        return nil
    }

    func decodeFlexibleBool(forKey key: Key) -> Bool {
        if let value = try? decodeIfPresent(Bool.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return value != 0
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return ["1", "true", "yes"].contains(value.lowercased())
        }
        return false
    }
}

enum LocalDatabaseError: Error, LocalizedError {
    case openFailed(String)
    case prepareFailed(String)
    case stepFailed(String)
    case missingDatabase

    var errorDescription: String? {
        switch self {
        case .openFailed(let message): "Could not open SQLite database: \(message)"
        case .prepareFailed(let message): "Could not prepare SQLite statement: \(message)"
        case .stepFailed(let message): "SQLite statement failed: \(message)"
        case .missingDatabase: "Database is not available"
        }
    }
}

enum RawDeflate {
    static func deflate(_ data: Data, level: Int32 = Z_BEST_COMPRESSION) -> Data? {
        guard !data.isEmpty else { return Data() }

        return data.withUnsafeBytes { inputBytes in
            guard let input = inputBytes.bindMemory(to: Bytef.self).baseAddress else { return nil }
            var stream = z_stream()
            stream.next_in = UnsafeMutablePointer<Bytef>(mutating: input)
            stream.avail_in = uInt(data.count)

            let initStatus = deflateInit2_(&stream, level, Z_DEFLATED, -MAX_WBITS, MAX_MEM_LEVEL, Z_DEFAULT_STRATEGY, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
            guard initStatus == Z_OK else { return nil }
            defer { deflateEnd(&stream) }

            var output = Data()
            var buffer = [UInt8](repeating: 0, count: 64 * 1024)
            let bufferSize = buffer.count
            var status: Int32 = Z_OK

            repeat {
                status = buffer.withUnsafeMutableBytes { outputBytes in
                    guard let outputBase = outputBytes.bindMemory(to: Bytef.self).baseAddress else { return Z_STREAM_ERROR }
                    stream.next_out = outputBase
                    stream.avail_out = uInt(bufferSize)
                    return zlib.deflate(&stream, Z_FINISH)
                }

                let produced = bufferSize - Int(stream.avail_out)
                if produced > 0 {
                    output.append(buffer, count: produced)
                }
            } while status == Z_OK

            return status == Z_STREAM_END ? output : nil
        }
    }

    static func inflateToString(_ data: Data) -> String? {
        inflate(data).flatMap { String(data: $0, encoding: .utf8) }
    }

    static func inflate(_ data: Data) -> Data? {
        guard !data.isEmpty else { return Data() }

        return data.withUnsafeBytes { inputBytes in
            guard let input = inputBytes.bindMemory(to: Bytef.self).baseAddress else { return nil }
            var stream = z_stream()
            stream.next_in = UnsafeMutablePointer<Bytef>(mutating: input)
            stream.avail_in = uInt(data.count)

            let initStatus = inflateInit2_(&stream, -MAX_WBITS, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
            guard initStatus == Z_OK else { return nil }
            defer { inflateEnd(&stream) }

            var output = Data()
            var buffer = [UInt8](repeating: 0, count: 64 * 1024)
            let bufferSize = buffer.count
            var status: Int32 = Z_OK

            repeat {
                status = buffer.withUnsafeMutableBytes { outputBytes in
                    guard let outputBase = outputBytes.bindMemory(to: Bytef.self).baseAddress else { return Z_STREAM_ERROR }
                    stream.next_out = outputBase
                    stream.avail_out = uInt(bufferSize)
                    return zlib.inflate(&stream, Z_NO_FLUSH)
                }

                let produced = bufferSize - Int(stream.avail_out)
                if produced > 0 {
                    output.append(buffer, count: produced)
                }
            } while status == Z_OK

            return status == Z_STREAM_END ? output : nil
        }
    }
}

final class LocalDatabase {
    static let currentUserId = "local-user"
    static let currentUserName = "Local Learner"

    private var handle: OpaquePointer?
    private let url: URL
    private var componentGlossesCache: [String: String]?
    private var componentUsesCache: ComponentUseIndex?
    private var japaneseLabelsCache: JapaneseLabelLookup?

    private init(url: URL, handle: OpaquePointer) {
        self.url = url
        self.handle = handle
    }

    deinit {
        sqlite3_close(handle)
    }

    static func openAppDatabase() throws -> LocalDatabase {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("Kiokun", isDirectory: true)
        try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let dbURL = support.appendingPathComponent("kiokun.sqlite")
        let resetForUITest = ProcessInfo.processInfo.arguments.contains("--kiokun-reset-local-store")

        if resetForUITest {
            try? SecureCredentialStore.delete(account: SecureCredentialStore.cloudflareSessionCookieAccount)
            UserDefaults.standard.removeObject(forKey: "cloudflareSessionCookie")
            UserDefaults.standard.removeObject(forKey: "cloudflareBaseURL")
        }

        if let bundled = Bundle.main.url(forResource: "KiokunDictionary", withExtension: "sqlite") {
            if resetForUITest && bundledDatabaseLooksDifferent(bundled: bundled, existing: dbURL) {
                removeSQLiteStore(at: dbURL)
            }
            if !FileManager.default.fileExists(atPath: dbURL.path) {
                try FileManager.default.copyItem(at: bundled, to: dbURL)
            }
        }

        var pointer: OpaquePointer?
        if sqlite3_open_v2(dbURL.path, &pointer, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) != SQLITE_OK {
            let message = pointer.flatMap { sqlite3_errmsg($0).map(String.init(cString:)) } ?? "unknown"
            throw LocalDatabaseError.openFailed(message)
        }
        guard let pointer else { throw LocalDatabaseError.missingDatabase }
        return LocalDatabase(url: dbURL, handle: pointer)
    }

    private static func removeSQLiteStore(at dbURL: URL) {
        for url in [
            dbURL,
            URL(fileURLWithPath: "\(dbURL.path)-wal"),
            URL(fileURLWithPath: "\(dbURL.path)-shm")
        ] {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private static func bundledDatabaseLooksDifferent(bundled: URL, existing: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: existing.path),
              let bundledSize = try? bundled.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              let existingSize = try? existing.resourceValues(forKeys: [.fileSizeKey]).fileSize else {
            return false
        }
        return bundledSize != existingSize
    }

    static func openDatabase(at dbURL: URL) throws -> LocalDatabase {
        try FileManager.default.createDirectory(at: dbURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        var pointer: OpaquePointer?
        if sqlite3_open_v2(dbURL.path, &pointer, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) != SQLITE_OK {
            let message = pointer.flatMap { sqlite3_errmsg($0).map(String.init(cString:)) } ?? "unknown"
            throw LocalDatabaseError.openFailed(message)
        }
        guard let pointer else { throw LocalDatabaseError.missingDatabase }
        return LocalDatabase(url: dbURL, handle: pointer)
    }

    func createSchema() throws {
        try execute("""
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dictionary_entries (
            key TEXT PRIMARY KEY NOT NULL,
            json TEXT,
            compressedData BLOB,
            sourceFormat TEXT NOT NULL DEFAULT 'json',
            dictionaryVersion TEXT NOT NULL,
            updatedAt INTEGER NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_search USING fts5(
            word,
            language,
            definition,
            pronunciation,
            reading_search,
            is_common,
            tokenize = 'porter unicode61'
        );

        CREATE TABLE IF NOT EXISTS static_assets (
            path TEXT PRIMARY KEY NOT NULL,
            compressedData BLOB NOT NULL,
            sourceBytes INTEGER NOT NULL,
            compressedBytes INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_profile (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            image TEXT,
            updatedAt INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            character TEXT NOT NULL,
            noteText TEXT NOT NULL,
            isAdmin INTEGER NOT NULL DEFAULT 0,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            dirty INTEGER NOT NULL DEFAULT 1,
            deleted INTEGER NOT NULL DEFAULT 0,
            syncedAt INTEGER,
            UNIQUE(userId, character)
        );

        CREATE TABLE IF NOT EXISTS study_cards (
            id TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            word TEXT NOT NULL,
            language TEXT NOT NULL,
            easeFactor INTEGER NOT NULL DEFAULT 250,
            interval INTEGER NOT NULL DEFAULT 0,
            repetitions INTEGER NOT NULL DEFAULT 0,
            nextReview INTEGER NOT NULL,
            lastReviewed INTEGER,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            dirty INTEGER NOT NULL DEFAULT 1,
            deleted INTEGER NOT NULL DEFAULT 0,
            syncedAt INTEGER,
            UNIQUE(userId, word)
        );

        CREATE TABLE IF NOT EXISTS custom_words (
            id TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            word TEXT NOT NULL UNIQUE,
            language TEXT NOT NULL,
            reading TEXT,
            definitions TEXT NOT NULL,
            notes TEXT,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            dirty INTEGER NOT NULL DEFAULT 1,
            deleted INTEGER NOT NULL DEFAULT 0,
            syncedAt INTEGER
        );

        CREATE TABLE IF NOT EXISTS artifacts (
            id TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            language TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'other',
            isPublic INTEGER NOT NULL DEFAULT 1,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            dirty INTEGER NOT NULL DEFAULT 1,
            deleted INTEGER NOT NULL DEFAULT 0,
            syncedAt INTEGER
        );

        CREATE TABLE IF NOT EXISTS artifact_images (
            id TEXT PRIMARY KEY NOT NULL,
            artifactId TEXT NOT NULL,
            imagePath TEXT NOT NULL,
            sortOrder INTEGER NOT NULL DEFAULT 0,
            createdAt INTEGER NOT NULL,
            dirty INTEGER NOT NULL DEFAULT 1,
            deleted INTEGER NOT NULL DEFAULT 0,
            syncedAt INTEGER,
            FOREIGN KEY (artifactId) REFERENCES artifacts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS artifact_sentences (
            id TEXT PRIMARY KEY NOT NULL,
            artifactId TEXT NOT NULL,
            imageId TEXT,
            originalText TEXT NOT NULL,
            translation TEXT,
            sortOrder INTEGER NOT NULL DEFAULT 0,
            createdAt INTEGER NOT NULL,
            dirty INTEGER NOT NULL DEFAULT 1,
            deleted INTEGER NOT NULL DEFAULT 0,
            syncedAt INTEGER,
            FOREIGN KEY (artifactId) REFERENCES artifacts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sentence_words (
            id TEXT PRIMARY KEY NOT NULL,
            sentenceId TEXT NOT NULL,
            wordSlug TEXT NOT NULL,
            surfaceForm TEXT NOT NULL,
            position INTEGER NOT NULL,
            dictionaryForm TEXT,
            reading TEXT,
            gloss TEXT,
            conjugation TEXT,
            createdAt INTEGER NOT NULL,
            dirty INTEGER NOT NULL DEFAULT 1,
            deleted INTEGER NOT NULL DEFAULT 0,
            syncedAt INTEGER,
            FOREIGN KEY (sentenceId) REFERENCES artifact_sentences(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY NOT NULL,
            entity TEXT NOT NULL,
            entityId TEXT NOT NULL,
            operation TEXT NOT NULL,
            payload TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            lastError TEXT,
            createdAt INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS notes_character_idx ON notes(character);
        CREATE INDEX IF NOT EXISTS study_due_idx ON study_cards(userId, nextReview);
        CREATE INDEX IF NOT EXISTS custom_words_word_idx ON custom_words(word);
        CREATE INDEX IF NOT EXISTS artifacts_user_idx ON artifacts(userId, updatedAt);
        CREATE INDEX IF NOT EXISTS sync_queue_created_idx ON sync_queue(createdAt);
        """)

        try addColumnIfMissing(table: "dictionary_entries", column: "compressedData", definition: "BLOB")
        try addColumnIfMissing(table: "dictionary_entries", column: "sourceFormat", definition: "TEXT NOT NULL DEFAULT 'json'")

        let now = Self.nowMillis()
        try run(
            "INSERT OR IGNORE INTO user_profile (id, name, email, image, updatedAt) VALUES (?, ?, ?, ?, ?)",
            [.text(Self.currentUserId), .text(Self.currentUserName), .null, .null, .int(now)]
        )
        try restoreUITestStaticAssetsFromBundle()
    }

    private func restoreUITestStaticAssetsFromBundle() throws {
        guard let bundled = Bundle.main.url(forResource: "KiokunDictionary", withExtension: "sqlite") else { return }
        try run("ATTACH DATABASE ? AS bundled_static_assets", [.text(bundled.path)])
        defer { try? run("DETACH DATABASE bundled_static_assets", []) }
        try execute("""
        INSERT OR REPLACE INTO static_assets
            (path, compressedData, sourceBytes, compressedBytes, updatedAt)
        SELECT path, compressedData, sourceBytes, compressedBytes, updatedAt
        FROM bundled_static_assets.static_assets
        WHERE path IN (
            'japanese_labels.json',
            'game_data/component_glosses.json',
            'game_data/component_uses.json'
        );
        """)
        invalidateStaticAssetCaches()
    }

    func resetUserDataForUITestIfNeeded() throws {
        guard ProcessInfo.processInfo.arguments.contains("--kiokun-reset-local-store") else { return }
        try execute("""
        PRAGMA foreign_keys = OFF;
        DELETE FROM sync_queue;
        DELETE FROM sentence_words;
        DELETE FROM artifact_sentences;
        DELETE FROM artifact_images;
        DELETE FROM artifacts;
        DELETE FROM custom_words;
        DELETE FROM study_cards;
        DELETE FROM notes;
        DELETE FROM user_profile;
        DELETE FROM app_metadata WHERE key IN ('seedVersion', 'lastSyncAt');
        PRAGMA foreign_keys = ON;
        """)
        let now = Self.nowMillis()
        try run(
            "INSERT OR IGNORE INTO user_profile (id, name, email, image, updatedAt) VALUES (?, ?, ?, ?, ?)",
            [.text(Self.currentUserId), .text(Self.currentUserName), .null, .null, .int(now)]
        )
    }

    func seedDevelopmentDataIfNeeded() throws {
        let seeded = try scalarText("SELECT value FROM app_metadata WHERE key = 'seedVersion'")
        guard seeded == nil else { return }

        if (try scalarInt("SELECT count(*) FROM dictionary_entries") ?? 0) > 0 {
            try run("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('seedVersion', 'bundled')", [])
            return
        }

        let now = Self.nowMillis()

        let entries: [(String, String)] = [
            ("地図", Self.entryJSON(
                key: "地図",
                sections: [
                    WordSection(language: .ja, headword: "地図", reading: "ちず", definitions: ["map", "atlas"], tags: ["common", "noun"]),
                    WordSection(language: .zh, headword: "地圖", reading: "dì tú", definitions: ["map"], tags: ["traditional"])
                ],
                related: ["地", "図", "地图"]
            )),
            ("好", Self.entryJSON(
                key: "好",
                sections: [
                    WordSection(language: .zh, headword: "好", reading: "hǎo", definitions: ["good", "well", "fine"], tags: ["HSK 1"]),
                    WordSection(language: .ja, headword: "好む", reading: "このむ", definitions: ["to like", "to prefer"], tags: ["verb"])
                ],
                related: ["好き", "良い"]
            )),
            ("学校", Self.entryJSON(
                key: "学校",
                sections: [
                    WordSection(language: .ja, headword: "学校", reading: "がっこう", definitions: ["school"], tags: ["common"]),
                    WordSection(language: .zh, headword: "學校 / 学校", reading: "xué xiào", definitions: ["school"], tags: [])
                ],
                related: ["学生", "先生"]
            )),
            ("食べる", Self.entryJSON(
                key: "食べる",
                sections: [
                    WordSection(language: .ja, headword: "食べる", reading: "たべる", definitions: ["to eat"], tags: ["ichidan verb", "common"])
                ],
                related: ["食事", "食う"]
            )),
            ("안녕", Self.entryJSON(
                key: "안녕",
                sections: [
                    WordSection(language: .ko, headword: "안녕", reading: "annyeong", definitions: ["hello", "peace", "well-being"], tags: ["greeting"])
                ],
                related: ["안녕하세요"]
            ))
        ]

        for (key, json) in entries {
            try run(
                "INSERT OR IGNORE INTO dictionary_entries (key, json, dictionaryVersion, updatedAt) VALUES (?, ?, ?, ?)",
                [.text(key), .text(json), .text("development-seed"), .int(now)]
            )
        }

        try execute("DELETE FROM dictionary_search")
        let searchRows: [(String, String, String, String, String, Int64)] = [
            ("地図", "japanese", "map", "ちず", "chizu", 1),
            ("地図", "japanese", "atlas", "ちず", "chizu", 1),
            ("地圖", "chinese", "map", "dì tú", "di tu", 1),
            ("好", "chinese", "good", "hǎo", "hao", 1),
            ("好", "chinese", "well", "hǎo", "hao", 1),
            ("好む", "japanese", "to like", "このむ", "konomu", 1),
            ("学校", "japanese", "school", "がっこう", "gakkou", 1),
            ("学校", "chinese", "school", "xué xiào", "xue xiao", 1),
            ("食べる", "japanese", "to eat", "たべる", "taberu", 1),
            ("안녕", "korean", "hello", "annyeong", "annyeong", 1)
        ]
        for row in searchRows {
            try run(
                "INSERT INTO dictionary_search (word, language, definition, pronunciation, reading_search, is_common) VALUES (?, ?, ?, ?, ?, ?)",
                [.text(row.0), .text(row.1), .text(row.2), .text(row.3), .text(row.4), .int(row.5)]
            )
        }

        try upsertNote(character: "地図", text: "Subway-safe local note. This is saved on-device first and queued for Cloudflare sync.")
        try addStudyCard(word: "食べる", language: .ja)
        try upsertCustomWord(CustomWordDraft(word: "推し活", language: .ja, reading: "おしかつ", definitions: "fan activities; supporting one's favorite idol", notes: "Custom words are first-class offline records."))
        try createArtifact(ArtifactDraft(title: "Train sign", description: "Example artifact for native offline capture.", language: .ja, type: "sign", isPublic: false))

        try run("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('seedVersion', '1')", [])
    }

    func seedUITestDataIfNeeded(environment: [String: String] = ProcessInfo.processInfo.environment) throws {
        try seedUITestStudyCardIfNeeded(environment: environment)
        try seedUITestRichRendererRecordIfNeeded(environment: environment)
        try seedUITestSyncTaskIfNeeded(environment: environment)
    }

    private func seedUITestStudyCardIfNeeded(environment: [String: String]) throws {
        guard let word = environment["KIOKUN_UI_TEST_STUDY_CARD"]?.trimmingCharacters(in: .whitespacesAndNewlines),
              !word.isEmpty else { return }
        let language = LanguageCode(rawValue: environment["KIOKUN_UI_TEST_STUDY_LANGUAGE"] ?? "") ?? .ja
        let reading = environment["KIOKUN_UI_TEST_STUDY_READING"] ?? ""
        let definition = environment["KIOKUN_UI_TEST_STUDY_DEFINITION"] ?? "UI test study card"
        let now = Self.nowMillis()
        let entry = Self.entryJSON(
            key: word,
            sections: [
                WordSection(language: language, headword: word, reading: reading, definitions: [definition], tags: ["ui-test"])
            ],
            related: []
        )
        try run(
            """
            INSERT OR IGNORE INTO dictionary_entries
                (key, json, dictionaryVersion, updatedAt)
            VALUES (?, ?, 'ui-test', ?)
            """,
            [.text(word), .text(entry), .int(now)]
        )
        try addStudyCard(word: word, language: language)
    }

    private func seedUITestRichRendererRecordIfNeeded(environment: [String: String]) throws {
        guard environment["KIOKUN_UI_TEST_RICH_RENDERER_RECORD"] == "1" else { return }

        let now = Self.nowMillis()
        let key = "語"
        try upsertUITestStaticAsset(
            path: "japanese_labels.json",
            json: #"{"partOfSpeech":{"n":"noun"},"misc":{"uk":"usually kana"},"field":{"ling":"linguistics"},"dialect":{"ksb":"Kansai"},"tag":{"iK":"irregular kanji"},"glossType":{"figurative":"figurative"}}"#
        )
        try upsertUITestStaticAsset(
            path: "game_data/component_glosses.json",
            json: #"{"言":"speech","吾":"I; me","信":"trust","詰":"to question","悟":"understand"}"#
        )
        try upsertUITestStaticAsset(
            path: "game_data/component_uses.json",
            json: #"{"言":{"meaning":{"chars":["語","信","詰"],"count":3,"verified":2}},"吾":{"sound":{"chars":["語","悟"],"count":2,"verified":1}},"語":{"meaning":{"chars":["譯","議"],"count":2,"verified":1},"sound":{"chars":["悟"],"count":1,"verified":1}}}"#
        )

        let json = """
        {
          "key": "語",
          "chinese_words": [
            {
              "_id": "ui-zh-1",
              "simp": "语",
              "trad": "語",
              "gloss": "language",
              "pinyinSearchString": "yu3",
              "jyutpingSearchString": "jyu5",
              "statistics": {"movieWordRank": 42, "bookWordCount": 9000},
              "items": [
                {
                  "source": "cc-cedict",
                  "pinyin": "yǔ",
                  "jyutping": "jyu5",
                  "simpTrad": "both",
                  "definitions": ["language", "speech"],
                  "tang": ["ngio"],
                  "variantRefs": ["語[yu3]"]
                }
              ]
            }
          ],
          "japanese_words": [
            {
              "id": "ui-jp-1",
              "kanji": [{"text": "語", "common": true, "tags": ["iK"], "pitchAccents": [1]}],
              "kana": [{"text": "ご", "common": true, "tags": [], "pitchAccents": [1]}],
              "sense": [
                {
                  "gloss": [{"lang": "eng", "type": "figurative", "text": "language"}],
                  "partOfSpeech": ["n"],
                  "field": ["ling"],
                  "misc": ["uk"],
                  "dialect": ["ksb"],
                  "info": ["suffix-like use"],
                  "related": [{"text": "言語", "type": "see"}],
                  "antonym": [{"text": "沈黙", "type": "ant"}],
                  "languageSource": [{"lang": "chi", "full": false, "wasei": false, "text": "語"}],
                  "examples": [
                    {
                      "source": {"type": "tatoeba", "value": "1"},
                      "sentences": [
                        {"lang": "jpn", "text": "日本語を話します。"},
                        {"lang": "eng", "text": "I speak Japanese."}
                      ]
                    }
                  ]
                }
              ]
            }
          ],
          "korean_words": [
            {
              "id": "ui-ko-1",
              "hangul": "어",
              "hanja": "語",
              "romanization": "eo",
              "pronunciation": "어",
              "pos": "noun",
              "origin": "sino_korean",
              "frequency_rank": 77,
              "definitions": [{"text": "language", "lang": "en", "sense_number": 1}],
              "examples": [{"korean": "한국어", "translation": "Korean language"}]
            }
          ],
          "chinese_char": {
            "char": "語",
            "codepoint": "U+8A9E",
            "strokeCount": 14,
            "sources": ["Unihan"],
            "gloss": "speech",
            "hint": "words from a mouth",
            "pinyinFrequencies": [{"pinyin": "yǔ", "count": 100}],
            "components": [
              {"character": "言", "meaning": "speech", "type": ["meaning"]},
              {"character": "吾", "meaning": "I; me", "type": ["sound"], "pinyin": "wú", "hint": "phonetic cue"}
            ],
            "statistics": {
              "hskLevel": 3,
              "topWords": [{"word": "語言", "trad": "語言", "gloss": "language", "share": 0.42}]
            },
            "variants": [{"char": "语", "source": "simplified"}],
            "oldPronunciations": [{"pinyin": "ngjo", "MC": "ngjoX", "OC": "ŋaʔ", "dynasty": "Middle Chinese"}],
            "comments": [{"comment": "common phonetic series", "source": "test"}],
            "images": [
              {
                "url": "https://example.com/form.png",
                "type": "seal",
                "era": "Qin",
                "source": "makemeahanzi",
                "data": {
                  "strokes": [
                    "M100 100 L300 100 L300 180 L100 180 Z",
                    "M120 260 L320 260 L320 340 L120 340 Z"
                  ],
                  "matches": [[0], [1]]
                }
              }
            ]
          }
        }
        """

        try run(
            """
            INSERT OR REPLACE INTO dictionary_entries
                (key, json, sourceFormat, dictionaryVersion, updatedAt)
            VALUES (?, ?, 'json', 'ui-test-rich-renderer', ?)
            """,
            [.text(key), .text(json), .int(now)]
        )
        try run("DELETE FROM dictionary_search WHERE word = ?", [.text(key)])
        try run(
            """
            INSERT INTO dictionary_search
                (word, language, definition, pronunciation, reading_search, is_common)
            VALUES
                (?, 'chinese', 'renderer parity language speech', 'yǔ', 'yu rendererparity', 1),
                (?, 'japanese', 'renderer parity language', 'ご', 'go rendererparity', 1),
                (?, 'korean', 'renderer parity language', '어', 'eo rendererparity', 1)
            """,
            [.text(key), .text(key), .text(key)]
        )
    }

    private func seedUITestSyncTaskIfNeeded(environment: [String: String]) throws {
        guard environment["KIOKUN_UI_TEST_SYNC_TASK"] == "1" else { return }
        try upsertCustomWord(
            CustomWordDraft(
                word: "同期テスト",
                language: .ja,
                reading: "どうきてすと",
                definitions: "sync recovery ui test",
                notes: "Seeded offline mutation for sync recovery UI coverage."
            )
        )
    }

    private func upsertUITestStaticAsset(path: String, json: String) throws {
        guard var data = json.data(using: .utf8) else { return }
        if let merged = try mergedUITestStaticAssetData(path: path, fixtureData: data) {
            data = merged
        }
        guard let compressed = RawDeflate.deflate(data) else { return }
        try run(
            """
            INSERT OR REPLACE INTO static_assets
                (path, compressedData, sourceBytes, compressedBytes, updatedAt)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                .text(path),
                .blob(compressed),
                .int(Int64(data.count)),
                .int(Int64(compressed.count)),
                .int(Self.nowMillis())
            ]
        )
        invalidateStaticAssetCaches()
    }

    private func invalidateStaticAssetCaches() {
        componentGlossesCache = nil
        componentUsesCache = nil
        japaneseLabelsCache = nil
    }

    private func mergedUITestStaticAssetData(path: String, fixtureData: Data) throws -> Data? {
        guard
            let existingText = try staticAssetText(path: path),
            let existingData = existingText.data(using: .utf8),
            let existingObject = try JSONSerialization.jsonObject(with: existingData) as? [String: Any],
            let fixtureObject = try JSONSerialization.jsonObject(with: fixtureData) as? [String: Any]
        else { return nil }

        let merged = Self.recursivelyMergedJSON(base: existingObject, overlay: fixtureObject)
        guard JSONSerialization.isValidJSONObject(merged) else { return nil }
        return try JSONSerialization.data(withJSONObject: merged, options: [.sortedKeys])
    }

    private static func recursivelyMergedJSON(base: [String: Any], overlay: [String: Any]) -> [String: Any] {
        var merged = base
        for (key, value) in overlay {
            if let baseObject = merged[key] as? [String: Any],
               let overlayObject = value as? [String: Any] {
                merged[key] = recursivelyMergedJSON(base: baseObject, overlay: overlayObject)
            } else {
                merged[key] = value
            }
        }
        return merged
    }

    static func entryJSON(key: String, sections: [WordSection], related: [String]) -> String {
        let grouped = Dictionary(grouping: sections, by: \.language)
        func sectionObjects(_ language: LanguageCode) -> [[String: Any]] {
            (grouped[language] ?? []).map {
                [
                    "headword": $0.headword,
                    "reading": $0.reading,
                    "definitions": $0.definitions,
                    "tags": $0.tags
                ]
            }
        }
        let object: [String: Any] = [
            "key": key,
            "chinese": sectionObjects(.zh),
            "japanese": sectionObjects(.ja),
            "korean": sectionObjects(.ko),
            "related": related
        ]
        let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? #"{"key":"\#(key)"}"#
    }

    func search(query: String, language: LanguageFilter) throws -> [SearchResult] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let langCondition: String
        var bindings: [SQLiteValue] = []

        if let code = language.code {
            langCondition = " AND language = ?"
            bindings.append(.text(code.searchLanguage))
        } else {
            langCondition = ""
        }

        let rows: [[String: String]]
        if trimmed.isEmpty {
            let commonRows = try queryRows("""
            SELECT word, language, definition, pronunciation, reading_search, is_common
            FROM dictionary_search
            WHERE is_common = 1\(langCondition)
            LIMIT 50
            """, bindings)
            if language == .zh && commonRows.isEmpty {
                return try frequencySearchResults(language: .zh, limit: 50)
            }
            rows = commonRows
        } else if trimmed.range(of: #"[\u{3000}-\u{9FFF}\u{AC00}-\u{D7AF}\u{F900}-\u{FAFF}]"#, options: .regularExpression) != nil {
            rows = try queryRows("""
            SELECT word, language, definition, pronunciation, reading_search, is_common
            FROM dictionary_search
            WHERE word LIKE ? || '%'\(langCondition)
            ORDER BY CASE WHEN word = ? THEN 1000 ELSE 0 END DESC, is_common DESC, length(word) ASC
            LIMIT 100
            """, [.text(trimmed)] + bindings + [.text(trimmed)])
        } else {
            let fts = trimmed
                .split(whereSeparator: { $0.isWhitespace })
                .map { $0.replacingOccurrences(of: "\"", with: "") + "*" }
                .joined(separator: " ")
            rows = try queryRows("""
            SELECT word, language, definition, pronunciation, reading_search, is_common
            FROM dictionary_search
            WHERE dictionary_search MATCH ?\(langCondition)
            ORDER BY is_common DESC, rank
            LIMIT 100
            """, [.text(fts)] + bindings)
        }

        var grouped: [String: SearchResult] = [:]
        for row in rows {
            let word = row["word"] ?? ""
            let resultKey = "\(word)-\(row["language"] ?? "")"
            let definition = row["definition"] ?? ""
            if var existing = grouped[resultKey] {
                if !existing.definitions.contains(definition) {
                    existing.definitions.append(definition)
                }
                grouped[resultKey] = existing
            } else {
                grouped[resultKey] = SearchResult(
                    word: word,
                    language: row["language"] ?? "",
                    pronunciation: row["pronunciation"] ?? "",
                    definitions: definition.isEmpty ? [] : [definition],
                    isCommon: row["is_common"] == "1"
                )
            }
        }
        if !trimmed.isEmpty,
           (language == .all || language == .ja),
           let deinflected = try deinflectedSearchResult(query: trimmed, language: .ja),
           !grouped.values.contains(where: { $0.word == deinflected.word || $0.word == deinflected.resolvedWord }) {
            grouped["\(deinflected.word)-japanese-deinflected"] = deinflected
        }
        if !trimmed.isEmpty,
           (language == .all || language == .ko),
           let deinflected = try deinflectedSearchResult(query: trimmed, language: .ko),
           !grouped.values.contains(where: { $0.word == deinflected.word || $0.word == deinflected.resolvedWord }) {
            grouped["\(deinflected.word)-korean-deinflected"] = deinflected
        }

        return Array(grouped.values).sorted {
            if $0.conjugationInfo != nil && $1.conjugationInfo == nil { return true }
            if $0.conjugationInfo == nil && $1.conjugationInfo != nil { return false }
            if $0.isCommon != $1.isCommon { return $0.isCommon && !$1.isCommon }
            if $0.word.count != $1.word.count { return $0.word.count < $1.word.count }
            return $0.word < $1.word
        }
    }

    private func frequencySearchResults(language: GameLanguage, limit: Int) throws -> [SearchResult] {
        let searchLanguage: String
        switch language {
        case .zh:
            searchLanguage = LanguageCode.zh.searchLanguage
        case .ja:
            searchLanguage = LanguageCode.ja.searchLanguage
        case .ko:
            searchLanguage = LanguageCode.ko.searchLanguage
        case .tr:
            return []
        }

        return try frequencyEntries(language: language)
            .prefix(max(1, limit))
            .map { entry in
                SearchResult(
                    word: entry.word,
                    language: searchLanguage,
                    pronunciation: entry.reading,
                    definitions: entry.definition.isEmpty ? [] : [entry.definition],
                    isCommon: true
                )
            }
    }

    func lookupReading(query: String, limit: Int = 5) throws -> [SearchResult] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        let normalized = Self.kanaToHiragana(trimmed)
        var readings: [String] = []
        for reading in [trimmed, normalized] where !reading.isEmpty && !readings.contains(reading) {
            readings.append(reading)
        }

        var grouped: [String: SearchResult] = [:]
        for reading in readings {
            let rows = try queryRows("""
            SELECT word, language, definition, pronunciation, reading_search, is_common
            FROM dictionary_search
            WHERE language = 'japanese'
              AND pronunciation = ?
              AND word != ?
              AND word != ?
            ORDER BY is_common DESC, length(word) ASC
            LIMIT ?
            """, [.text(reading), .text(trimmed), .text(normalized), .int(Int64(max(1, min(limit, 20))))])

            for row in rows {
                let word = row["word"] ?? ""
                guard !word.isEmpty else { continue }
                let resultKey = "\(word)-japanese"
                let definition = row["definition"] ?? ""
                if var existing = grouped[resultKey] {
                    if !definition.isEmpty && !existing.definitions.contains(definition) {
                        existing.definitions.append(definition)
                    }
                    grouped[resultKey] = existing
                } else {
                    grouped[resultKey] = SearchResult(
                        word: word,
                        language: "japanese",
                        pronunciation: row["pronunciation"] ?? reading,
                        definitions: definition.isEmpty ? ["reading match"] : [definition],
                        isCommon: row["is_common"] == "1"
                    )
                }
            }
        }

        return Array(grouped.values)
            .sorted {
                if $0.isCommon != $1.isCommon { return $0.isCommon && !$1.isCommon }
                if $0.word.count != $1.word.count { return $0.word.count < $1.word.count }
                return $0.word < $1.word
            }
            .prefix(max(1, min(limit, 20)))
            .map { $0 }
    }

    static func kanaToHiragana(_ text: String) -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            if scalar.value >= 0x30A1 && scalar.value <= 0x30F6,
               let hiragana = UnicodeScalar(scalar.value - 0x60) {
                scalars.append(hiragana)
            } else {
                scalars.append(scalar)
            }
        }
        return String(scalars)
    }

    func lookup(word: String) throws -> DictionaryRecord? {
        if let payload = try dictionaryPayload(word: word),
           let json = payload.json ?? payload.compressedData.flatMap({ RawDeflate.inflateToString($0) }) {
            guard var record = Self.decodeRecord(
                json: json,
                componentGlosses: (try? componentGlosses()) ?? [:],
                componentUses: (try? componentUses()) ?? [:],
                japaneseLabels: (try? japaneseLabels()) ?? .empty
            ) else { return nil }
            record.japanese = try record.japanese.map { section in
                var enriched = section
                enriched.pitchAccent = try pitchAccent(word: section.headword, reading: section.reading)
                return enriched
            }
            return record
        }

        if let custom = try listCustomWords().first(where: { $0.word == word && !$0.definitions.isEmpty }) {
            let section = WordSection(
                language: custom.language,
                headword: custom.word,
                reading: custom.reading,
                definitions: custom.definitions,
                tags: ["custom"]
            )
            return DictionaryRecord(
                key: custom.word,
                redirect: nil,
                chinese: custom.language == .zh ? [section] : [],
                japanese: custom.language == .ja ? [section] : [],
                korean: custom.language == .ko ? [section] : [],
                characters: [],
                japaneseNames: [],
                contains: [],
                containedInChinese: [],
                containedInJapanese: [],
                containedInKorean: [],
                similarCharacters: [],
                related: [],
                rawJSON: "{}"
            )
        }

        return nil
    }

    func lookupResolved(word: String) throws -> ResolvedDictionaryLookup? {
        if let record = try lookup(word: word) {
            return ResolvedDictionaryLookup(record: record, inflection: nil)
        }
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        if KoreanDeinflector.isHangulOnly(trimmed), let match = try resolveKoreanInflection(word: trimmed) {
            return ResolvedDictionaryLookup(record: match.record, inflection: match.inflection)
        }
        if let match = try resolveJapaneseInflection(word: trimmed) {
            return ResolvedDictionaryLookup(record: match.record, inflection: match.inflection)
        }
        if let match = try resolveKoreanInflection(word: trimmed) {
            return ResolvedDictionaryLookup(record: match.record, inflection: match.inflection)
        }
        return nil
    }

    func inflectionAlternatives(word: String, maxResults: Int = 5) throws -> [DictionaryInflectionMatch] {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        if KoreanDeinflector.isHangulOnly(trimmed) {
            let koreanMatches = try resolveKoreanInflections(word: trimmed, maxResults: maxResults)
            if !koreanMatches.isEmpty {
                return koreanMatches.map { $0.inflection }
            }
        }

        let japaneseMatches = try resolveJapaneseInflections(word: trimmed, maxResults: maxResults)
        if !japaneseMatches.isEmpty {
            return japaneseMatches.map { $0.inflection }
        }

        return try resolveKoreanInflections(word: trimmed, maxResults: maxResults).map { $0.inflection }
    }

    private func resolveJapaneseInflection(word: String) throws -> (record: DictionaryRecord, inflection: DictionaryInflectionMatch)? {
        try resolveJapaneseInflections(word: word, maxResults: 1).first
    }

    private func resolveJapaneseInflections(word: String, maxResults: Int = 5) throws -> [(record: DictionaryRecord, inflection: DictionaryInflectionMatch)] {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        var matches: [(record: DictionaryRecord, inflection: DictionaryInflectionMatch)] = []
        var seen = Set<String>()

        for candidate in JapaneseDeinflector.candidates(for: trimmed) {
            guard matches.count < maxResults else { break }
            var foundDirectMatch = false

            if let record = try lookup(word: candidate.word),
               !record.japanese.isEmpty,
               candidate.expectedTypes.matches(record: record) {
                let dictionaryForm = record.key
                if seen.insert(dictionaryForm).inserted {
                    matches.append((
                        record,
                        DictionaryInflectionMatch(
                            original: trimmed,
                            dictionaryForm: dictionaryForm,
                            conjugationInfo: candidate.conjugationInfo
                        )
                    ))
                }
                foundDirectMatch = true
            }

            guard !foundDirectMatch else { continue }

            for readingResult in try lookupReading(query: candidate.word, limit: 10) {
                guard matches.count < maxResults else { break }
                guard let record = try lookup(word: readingResult.word),
                      !record.japanese.isEmpty,
                      candidate.expectedTypes.matches(record: record) else { continue }
                let dictionaryForm = record.key
                guard seen.insert(dictionaryForm).inserted else { continue }
                matches.append((
                    record,
                    DictionaryInflectionMatch(
                        original: trimmed,
                        dictionaryForm: dictionaryForm,
                        conjugationInfo: candidate.conjugationInfo
                    )
                ))
            }
        }
        return matches
    }

    private func resolveKoreanInflection(word: String) throws -> (record: DictionaryRecord, inflection: DictionaryInflectionMatch)? {
        try resolveKoreanInflections(word: word, maxResults: 1).first
    }

    private func resolveKoreanInflections(word: String, maxResults: Int = 5) throws -> [(record: DictionaryRecord, inflection: DictionaryInflectionMatch)] {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        var matches: [(record: DictionaryRecord, inflection: DictionaryInflectionMatch)] = []
        var seen = Set<String>()

        for candidate in KoreanDeinflector.candidates(for: trimmed) {
            guard matches.count < maxResults else { break }
            guard let record = try lookup(word: candidate.word), !record.korean.isEmpty else { continue }
            let dictionaryForm = record.key
            guard seen.insert(dictionaryForm).inserted else { continue }
            matches.append((
                record,
                DictionaryInflectionMatch(
                    original: trimmed,
                    dictionaryForm: dictionaryForm,
                    conjugationInfo: candidate.conjugationInfo
                )
            ))
        }
        return matches
    }

    func deinflectedSearchResult(query: String, language: LanguageCode? = nil) throws -> SearchResult? {
        switch language {
        case .some(.zh):
            return nil
        case .some(.ja):
            let matches = try resolveJapaneseInflections(word: query)
            guard let match = matches.first else { return nil }
            return searchResult(for: match, alternatives: matches.dropFirst().map { $0.inflection }, section: match.record.japanese.first, language: "japanese")
        case .some(.ko):
            let matches = try resolveKoreanInflections(word: query)
            guard let match = matches.first else { return nil }
            return searchResult(for: match, alternatives: matches.dropFirst().map { $0.inflection }, section: match.record.korean.first, language: "korean")
        case nil:
            if KoreanDeinflector.isHangulOnly(query) {
                let matches = try resolveKoreanInflections(word: query)
                if let match = matches.first {
                    return searchResult(for: match, alternatives: matches.dropFirst().map { $0.inflection }, section: match.record.korean.first, language: "korean")
                }
            }
            let japaneseMatches = try resolveJapaneseInflections(word: query)
            if let match = japaneseMatches.first {
                return searchResult(for: match, alternatives: japaneseMatches.dropFirst().map { $0.inflection }, section: match.record.japanese.first, language: "japanese")
            }
            let koreanMatches = try resolveKoreanInflections(word: query)
            if let match = koreanMatches.first {
                return searchResult(for: match, alternatives: koreanMatches.dropFirst().map { $0.inflection }, section: match.record.korean.first, language: "korean")
            }
            return nil
        }
    }

    private func searchResult(
        for match: (record: DictionaryRecord, inflection: DictionaryInflectionMatch),
        alternatives: [DictionaryInflectionMatch] = [],
        section: WordSection?,
        language: String
    ) -> SearchResult {
        var definitions = section?.definitions ?? []
        if definitions.isEmpty {
            definitions = ["deinflected dictionary match"]
        }
        definitions.insert("\(match.inflection.original) → \(match.inflection.dictionaryForm) (\(match.inflection.conjugationInfo))", at: 0)
        let reading = section?.reading ?? ""
        let pronunciation = reading.isEmpty ? "→ \(match.inflection.dictionaryForm)" : "→ \(match.inflection.dictionaryForm) · \(reading)"
        return SearchResult(
            word: match.inflection.original,
            language: language,
            pronunciation: pronunciation,
            definitions: definitions,
            isCommon: true,
            resolvedWord: match.inflection.dictionaryForm,
            conjugationInfo: match.inflection.conjugationInfo,
            alternativeInflections: alternatives
        )
    }

    func dictionaryPayload(word: String) throws -> (json: String?, compressedData: Data?)? {
        guard let handle else { throw LocalDatabaseError.missingDatabase }
        let sql = "SELECT json, compressedData FROM dictionary_entries WHERE key = ? LIMIT 1"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw LocalDatabaseError.prepareFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(statement) }
        try bind([.text(word)], to: statement)
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }

        let json = sqlite3_column_text(statement, 0).map { String(cString: $0) }
        var blobData: Data?
        if let blob = sqlite3_column_blob(statement, 1) {
            let size = Int(sqlite3_column_bytes(statement, 1))
            blobData = Data(bytes: blob, count: size)
        }
        return (json, blobData)
    }

    func listStaticAssetSummaries() throws -> [StaticAssetSummary] {
        try queryRows("""
        SELECT path, sourceBytes, compressedBytes
        FROM static_assets
        ORDER BY path
        """).map {
            StaticAssetSummary(
                path: $0["path"] ?? "",
                sourceBytes: Int($0["sourceBytes"] ?? "0") ?? 0,
                compressedBytes: Int($0["compressedBytes"] ?? "0") ?? 0
            )
        }
    }

    func staticAssetText(path: String) throws -> String? {
        guard let data = try staticAssetData(path: path) else { return nil }
        return RawDeflate.inflateToString(data)
    }

    func staticAssetData(path: String) throws -> Data? {
        guard let handle else { throw LocalDatabaseError.missingDatabase }
        let sql = "SELECT compressedData FROM static_assets WHERE path = ? LIMIT 1"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw LocalDatabaseError.prepareFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(statement) }
        try bind([.text(path)], to: statement)
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
        guard let blob = sqlite3_column_blob(statement, 0) else { return nil }
        let size = Int(sqlite3_column_bytes(statement, 0))
        return Data(bytes: blob, count: size)
    }

    func componentGlosses() throws -> [String: String] {
        if let componentGlossesCache {
            return componentGlossesCache
        }
        guard
            let text = try staticAssetText(path: "game_data/component_glosses.json"),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return [:]
        }
        let glosses = object.compactMapValues { value -> String? in
            switch value {
            case let string as String:
                return string
            case let number as NSNumber:
                return number.stringValue
            default:
                return nil
            }
        }
        componentGlossesCache = glosses
        return glosses
    }

    func japaneseLabels() throws -> JapaneseLabelLookup {
        if let japaneseLabelsCache {
            return japaneseLabelsCache
        }
        guard let text = try staticAssetText(path: "japanese_labels.json") else {
            japaneseLabelsCache = .empty
            return .empty
        }
        let labels = JapaneseLabelLookup.decode(json: text)
        japaneseLabelsCache = labels
        return labels
    }

    func componentUses() throws -> ComponentUseIndex {
        if let componentUsesCache {
            return componentUsesCache
        }
        guard
            let text = try staticAssetText(path: "game_data/component_uses.json"),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return [:]
        }

        var index: ComponentUseIndex = [:]
        for (component, rawBuckets) in object {
            guard let bucketObject = rawBuckets as? [String: Any] else { continue }
            var buckets: [String: ComponentUseBucket] = [:]
            for (role, rawPayload) in bucketObject {
                guard let payload = rawPayload as? [String: Any] else { continue }
                let chars = payload["chars"] as? [String] ?? []
                let count = (payload["count"] as? NSNumber)?.intValue ?? chars.count
                let verified = (payload["verified"] as? NSNumber)?.intValue ?? 0
                buckets[role] = ComponentUseBucket(chars: chars, count: count, verified: verified)
            }
            if !buckets.isEmpty {
                index[component] = buckets
            }
        }
        componentUsesCache = index
        return index
    }

    func phoneticSeries(component: String, limit: Int = 30) throws -> [PhoneticSeriesCharacter] {
        let trimmed = component.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        let uses = try componentUses()
        let glosses = try componentGlosses()
        let soundChars = uses[trimmed]?["sound"]?.chars ?? uses[trimmed]?["phonetic"]?.chars ?? []

        var series: [PhoneticSeriesCharacter] = []
        for character in soundChars.prefix(limit) {
            let record = try? lookup(word: character)
            let characterSummary = record?.characters.first { $0.language == .zh && $0.form == character }
                ?? record?.characters.first { $0.language == .zh }
            let readings = characterSummary?.readings ?? []
            let gloss = cleanComponentGloss(
                glosses[character] ?? characterSummary?.meanings.first ?? ""
            )
            series.append(PhoneticSeriesCharacter(character: character, pinyin: readings, gloss: gloss))
        }
        return series
    }

    func phoneticComponentGloss(_ component: String) throws -> String {
        let curated = cleanComponentGloss(try componentGlosses()[component] ?? "")
        if !curated.isEmpty {
            return curated
        }
        return try dictionaryGloss(forComponent: component)
    }

    private func dictionaryGloss(forComponent component: String) throws -> String {
        guard let record = try lookup(word: component) else { return "" }
        let exactCharacter = record.characters.first { $0.language == .zh && $0.form == component }
            ?? record.characters.first { $0.form == component }
            ?? record.characters.first { $0.language == .zh }
            ?? record.characters.first
        if let gloss = exactCharacter?.meanings.first {
            return cleanComponentGloss(gloss)
        }

        let exactSection = record.allSections.first { $0.headword == component }
            ?? record.allSections.first { $0.headword.contains(component) }
            ?? record.allSections.first
        if let gloss = exactSection?.definitions.first {
            return cleanComponentGloss(gloss)
        }
        return ""
    }

    func staticAssetPaths(prefix: String) throws -> [String] {
        try queryRows("""
        SELECT path
        FROM static_assets
        WHERE path LIKE ?
        ORDER BY path
        """, [.text("\(prefix)%")]).compactMap { $0["path"] }
    }

    func staticAssetDecoded<T: Decodable>(_ type: T.Type, path: String) throws -> T? {
        guard
            let compressed = try staticAssetData(path: path),
            let data = RawDeflate.inflate(compressed)
        else { return nil }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func homophoneGroups(language: GameLanguage, mode: HomophoneMode) throws -> [HomophoneGroup] {
        guard
            let path = Self.homophoneAssetPath(language: language, mode: mode),
            let text = try staticAssetText(path: path),
            let data = text.data(using: .utf8),
            let rawGroups = try JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [] }

        return rawGroups.compactMap { rawGroup -> HomophoneGroup? in
            let reading = Self.jsonString(rawGroup["r"])
            guard !reading.isEmpty else { return nil }
            let displayReading = Self.jsonString(rawGroup["p"])
            let rawEntries = rawGroup["w"] as? [[String: Any]] ?? []
            let entries = rawEntries.compactMap { rawEntry -> HomophoneEntry? in
                let word = Self.jsonString(rawEntry["w"])
                guard !word.isEmpty else { return nil }
                let pinyin = Self.jsonString(rawEntry["p"])
                let hangul = Self.jsonString(rawEntry["h"])
                let entryReading = [pinyin, hangul, reading].first(where: { !$0.isEmpty }) ?? reading
                return HomophoneEntry(
                    word: word,
                    reading: entryReading,
                    glosses: Self.jsonStringArray(rawEntry["g"]),
                    pinyin: pinyin,
                    hangul: hangul,
                    isCommon: Self.jsonBool(rawEntry["c"]),
                    partsOfSpeech: Self.jsonStringArray(rawEntry["p"]).filter { $0 != pinyin },
                    accent: Self.jsonInt(rawEntry["a"])
                )
            }
            guard !entries.isEmpty else { return nil }
            return HomophoneGroup(
                language: language,
                mode: language == .ko ? .words : mode,
                reading: reading,
                displayReading: displayReading.isEmpty ? reading : displayReading,
                entries: entries
            )
        }
    }

    static func homophoneAssetPath(language: GameLanguage, mode: HomophoneMode) -> String? {
        switch (language, mode) {
        case (.ja, .words): "homophones_ja_words.json"
        case (.ja, .characters): "homophones_ja_chars.json"
        case (.zh, .words): "homophones_zh_words.json"
        case (.zh, .characters): "homophones_zh_chars.json"
        case (.ko, _): "homophones_kr_words.json"
        case (.tr, _): nil
        }
    }

    func frequencyEntries(language: GameLanguage) throws -> [FrequencyEntry] {
        guard
            let key = Self.frequencyAssetKey(language: language),
            let text = try staticAssetText(path: "frequency_list.json"),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rows = object[key] as? [[String: Any]]
        else { return [] }

        return rows.compactMap { row -> FrequencyEntry? in
            let word = Self.jsonString(row["word"])
            guard !word.isEmpty else { return nil }
            return FrequencyEntry(
                language: language,
                rank: Self.jsonInt(row["rank"]) ?? 0,
                word: word,
                reading: Self.jsonString(row["reading"]),
                definition: Self.jsonString(row["definition"]),
                isCommon: Self.jsonBool(row["common"])
            )
        }
    }

    static func frequencyAssetKey(language: GameLanguage) -> String? {
        switch language {
        case .ja: "japanese"
        case .zh: "chinese"
        case .ko: "korean"
        case .tr: nil
        }
    }

    func reelVideos(language: GameLanguage) throws -> [ReelVideo] {
        guard
            let path = Self.reelVideoDataPath(language: language),
            let text = try staticAssetText(path: path),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rawVideos = object["videos"] as? [String: Any]
        else { return [] }

        let rawWords = object["words"] as? [String: Any] ?? [:]
        var sampleWordByVideo: [String: String] = [:]
        for (word, rawOccurrences) in rawWords {
            guard let occurrences = rawOccurrences as? [[String: Any]] else { continue }
            for occurrence in occurrences {
                let videoId = Self.jsonString(occurrence["video_id"])
                if !videoId.isEmpty, sampleWordByVideo[videoId] == nil {
                    sampleWordByVideo[videoId] = word
                }
            }
        }

        return rawVideos.compactMap { videoId, rawVideo -> ReelVideo? in
            guard let payload = rawVideo as? [String: Any] else { return nil }
            let url = Self.jsonString(payload["url"])
            let fallbackUrl = "https://cdn.cosmos.so/\(videoId).mp4"
            return ReelVideo(
                videoId: videoId,
                language: language,
                url: url.isEmpty ? fallbackUrl : url,
                thumbnail: Self.jsonString(payload["thumbnail"]),
                wordCount: Self.jsonInt(payload["word_count"]) ?? 0,
                sourceUrl: Self.jsonString(payload["source_url"]),
                author: Self.jsonString(payload["author"]),
                caption: Self.jsonString(payload["caption"]),
                duration: Self.jsonDouble(payload["duration"]),
                sampleWord: sampleWordByVideo[videoId] ?? ""
            )
        }
        .sorted {
            if $0.wordCount == $1.wordCount {
                return $0.videoId < $1.videoId
            }
            return $0.wordCount > $1.wordCount
        }
    }

    func reelOccurrences(word: String, language: GameLanguage) throws -> [ReelOccurrence] {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !trimmed.isEmpty,
            let path = Self.reelVideoDataPath(language: language),
            let text = try staticAssetText(path: path),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rawWords = object["words"] as? [String: Any],
            let rawOccurrences = rawWords[trimmed] as? [[String: Any]]
        else { return [] }

        let videosById = Dictionary(uniqueKeysWithValues: try reelVideos(language: language).map { ($0.videoId, $0) })
        return rawOccurrences.compactMap { occurrence -> ReelOccurrence? in
            let videoId = Self.jsonString(occurrence["video_id"])
            let sentence = Self.jsonString(occurrence["sentence"])
            guard !videoId.isEmpty, !sentence.isEmpty else { return nil }
            let start = Self.jsonDouble(occurrence["start_time"]) ?? 0
            return ReelOccurrence(
                language: language,
                word: trimmed,
                videoId: videoId,
                startTime: start,
                endTime: Self.jsonDouble(occurrence["end_time"]) ?? start,
                sentence: sentence,
                video: videosById[videoId]
            )
        }
        .sorted {
            if $0.videoId == $1.videoId {
                return $0.startTime < $1.startTime
            }
            return ($0.video?.wordCount ?? 0) > ($1.video?.wordCount ?? 0)
        }
    }

    func reelDetail(videoId: String, language: GameLanguage) throws -> ReelDetail? {
        guard let video = try reelVideos(language: language).first(where: { $0.videoId == videoId }) else {
            return nil
        }
        let transcript = try reelTranscript(videoId: videoId, language: language)
        return ReelDetail(video: video, transcript: transcript)
    }

    func reelTranscript(videoId: String, language: GameLanguage) throws -> [ReelTranscriptSegment] {
        if
            let path = Self.reelTranscriptPath(language: language),
            let text = try staticAssetText(path: path),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rawSegments = object[videoId] as? [[String: Any]],
            !rawSegments.isEmpty
        {
            return rawSegments.compactMap { rawSegment -> ReelTranscriptSegment? in
                let sentence = Self.jsonString(rawSegment["sentence"])
                guard !sentence.isEmpty else { return nil }
                return ReelTranscriptSegment(
                    startTime: Self.jsonDouble(rawSegment["start_time"]) ?? 0,
                    endTime: Self.jsonDouble(rawSegment["end_time"]) ?? 0,
                    sentence: sentence,
                    words: Self.jsonStringArray(rawSegment["words"]),
                    confidence: Self.jsonDouble(rawSegment["confidence"])
                )
            }
            .sorted { $0.startTime < $1.startTime }
        }

        return try reelTranscriptFromOccurrences(videoId: videoId, language: language)
    }

    private func reelTranscriptFromOccurrences(videoId: String, language: GameLanguage) throws -> [ReelTranscriptSegment] {
        guard
            let path = Self.reelVideoDataPath(language: language),
            let text = try staticAssetText(path: path),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rawWords = object["words"] as? [String: Any]
        else { return [] }

        var segmentsByKey: [String: ReelTranscriptSegment] = [:]
        for (word, rawOccurrences) in rawWords {
            guard let occurrences = rawOccurrences as? [[String: Any]] else { continue }
            for occurrence in occurrences where Self.jsonString(occurrence["video_id"]) == videoId {
                let start = Self.jsonDouble(occurrence["start_time"]) ?? 0
                let end = Self.jsonDouble(occurrence["end_time"]) ?? start
                let sentence = Self.jsonString(occurrence["sentence"])
                guard !sentence.isEmpty else { continue }
                let key = "\(start)-\(end)-\(sentence)"
                var segment = segmentsByKey[key] ?? ReelTranscriptSegment(
                    startTime: start,
                    endTime: end,
                    sentence: sentence,
                    words: [],
                    confidence: nil
                )
                if !segment.words.contains(word) {
                    segment.words.append(word)
                }
                segmentsByKey[key] = segment
            }
        }
        return segmentsByKey.values.sorted { $0.startTime < $1.startTime }
    }

    static func reelVideoDataPath(language: GameLanguage) -> String? {
        switch language {
        case .ja: "video_data.json"
        case .zh: "chinese_video_data.json"
        case .ko, .tr: nil
        }
    }

    static func reelTranscriptPath(language: GameLanguage) -> String? {
        switch language {
        case .ja: "reel_transcripts_full.json"
        case .zh: "reel_transcripts_zh_full.json"
        case .ko, .tr: nil
        }
    }

    static func romajiToHiragana(_ input: String) -> String {
        let map: [String: String] = [
            "a": "あ", "i": "い", "u": "う", "e": "え", "o": "お",
            "ka": "か", "ki": "き", "ku": "く", "ke": "け", "ko": "こ",
            "sa": "さ", "si": "し", "shi": "し", "su": "す", "se": "せ", "so": "そ",
            "ta": "た", "ti": "ち", "chi": "ち", "tu": "つ", "tsu": "つ", "te": "て", "to": "と",
            "na": "な", "ni": "に", "nu": "ぬ", "ne": "ね", "no": "の",
            "ha": "は", "hi": "ひ", "hu": "ふ", "fu": "ふ", "he": "へ", "ho": "ほ",
            "ma": "ま", "mi": "み", "mu": "む", "me": "め", "mo": "も",
            "ya": "や", "yu": "ゆ", "yo": "よ",
            "ra": "ら", "ri": "り", "ru": "る", "re": "れ", "ro": "ろ",
            "wa": "わ", "wo": "を", "n": "ん",
            "ga": "が", "gi": "ぎ", "gu": "ぐ", "ge": "げ", "go": "ご",
            "za": "ざ", "zi": "じ", "ji": "じ", "zu": "ず", "ze": "ぜ", "zo": "ぞ",
            "da": "だ", "di": "ぢ", "du": "づ", "de": "で", "do": "ど",
            "ba": "ば", "bi": "び", "bu": "ぶ", "be": "べ", "bo": "ぼ",
            "pa": "ぱ", "pi": "ぴ", "pu": "ぷ", "pe": "ぺ", "po": "ぽ",
            "kya": "きゃ", "kyu": "きゅ", "kyo": "きょ",
            "sha": "しゃ", "shu": "しゅ", "sho": "しょ",
            "cha": "ちゃ", "chu": "ちゅ", "cho": "ちょ",
            "nya": "にゃ", "nyu": "にゅ", "nyo": "にょ",
            "hya": "ひゃ", "hyu": "ひゅ", "hyo": "ひょ",
            "mya": "みゃ", "myu": "みゅ", "myo": "みょ",
            "rya": "りゃ", "ryu": "りゅ", "ryo": "りょ",
            "gya": "ぎゃ", "gyu": "ぎゅ", "gyo": "ぎょ",
            "ja": "じゃ", "ju": "じゅ", "jo": "じょ",
            "bya": "びゃ", "byu": "びゅ", "byo": "びょ",
            "pya": "ぴゃ", "pyu": "ぴゅ", "pyo": "ぴょ"
        ]

        var remaining = input.lowercased()
        var output = ""
        while !remaining.isEmpty {
            let first = remaining.first!
            if remaining.count >= 2 {
                let pair = Array(remaining.prefix(2))
                if pair[0] == pair[1], pair[0] != "n", pair[0].isLetter {
                    output += "っ"
                    remaining.removeFirst()
                    continue
                }
            }

            var matched = false
            for length in [3, 2, 1] where remaining.count >= length {
                let chunk = String(remaining.prefix(length))
                if let kana = map[chunk] {
                    output += kana
                    remaining.removeFirst(length)
                    matched = true
                    break
                }
            }
            if !matched {
                output.append(first)
                remaining.removeFirst()
            }
        }
        return output
    }

    static func countJapaneseMorae(_ reading: String) -> Int {
        japaneseMorae(from: reading).count
    }

    static func japaneseMorae(from reading: String) -> [String] {
        let smallKana = Set("ゃゅょャュョぁぃぅぇぉァィゥェォ")
        let characters = Array(reading)
        var output: [String] = []
        var index = 0
        while index < characters.count {
            let current = characters[index]
            if index + 1 < characters.count {
                let next = characters[index + 1]
                if smallKana.contains(next) || next == "ー" {
                    output.append(String(current) + String(next))
                    index += 2
                    continue
                }
            }
            output.append(String(current))
            index += 1
        }
        return output
    }

    static func jsonString(_ value: Any?) -> String {
        switch value {
        case let string as String:
            string
        case let number as NSNumber:
            number.stringValue
        case let array as [Any]:
            array.map { jsonString($0) }.filter { !$0.isEmpty }.joined(separator: ", ")
        default:
            ""
        }
    }

    static func jsonStringArray(_ value: Any?) -> [String] {
        switch value {
        case let strings as [String]:
            strings
        case let array as [Any]:
            array.map { jsonString($0) }.filter { !$0.isEmpty }
        case let string as String:
            string.isEmpty ? [] : [string]
        case let number as NSNumber:
            [number.stringValue]
        default:
            []
        }
    }

    static func jsonBool(_ value: Any?) -> Bool {
        switch value {
        case let bool as Bool:
            bool
        case let number as NSNumber:
            number.intValue != 0
        case let string as String:
            ["1", "true", "yes"].contains(string.lowercased())
        default:
            false
        }
    }

    static func jsonInt(_ value: Any?) -> Int? {
        switch value {
        case let int as Int:
            int
        case let number as NSNumber:
            number.intValue
        case let string as String:
            Int(string)
        default:
            nil
        }
    }

    static func jsonDouble(_ value: Any?) -> Double? {
        switch value {
        case let double as Double:
            double
        case let int as Int:
            Double(int)
        case let number as NSNumber:
            number.doubleValue
        case let string as String:
            Double(string)
        default:
            nil
        }
    }

    func pitchAccent(word: String, reading: String) throws -> PitchAccentPattern? {
        let forms = Self.uniqueLookupForms([
            Self.firstLookupForm(word),
            Self.firstLookupForm(reading),
            word,
            reading
        ])

        for form in forms {
            guard
                let text = try staticAssetText(path: "pitch/\(Self.sentenceIndexShard(for: form)).json"),
                let data = text.data(using: .utf8),
                let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let readings = object[form] as? [String: Any]
            else { continue }

            let preferredReading = Self.firstLookupForm(reading)
            if !preferredReading.isEmpty, let accent = Self.jsonInt(readings[preferredReading]) {
                return PitchAccentPattern(word: form, reading: preferredReading, accent: accent)
            }
            if let accent = Self.jsonInt(readings[""]) {
                return PitchAccentPattern(word: form, reading: preferredReading, accent: accent)
            }
            if let first = readings.sorted(by: { $0.key < $1.key }).first,
               let accent = Self.jsonInt(first.value) {
                return PitchAccentPattern(word: form, reading: first.key, accent: accent)
            }
        }

        return nil
    }

    func sentenceExamples(
        word: String,
        language: LanguageCode,
        fallbackWords: [String] = [],
        limit: Int = 24
    ) throws -> [StaticSentenceExample] {
        guard limit > 0 else { return [] }
        let folder: String
        switch language {
        case .zh:
            folder = "zh_sentences"
        case .ko:
            folder = "kr_sentences"
        case .ja:
            return []
        }

        var refs = try sentenceReferences(word: word, folder: folder)
        if refs.isEmpty, language == .ko {
            for fallback in fallbackWords.prefix(30) {
                refs.append(contentsOf: try sentenceReferences(word: fallback, folder: folder))
                if refs.count >= limit { break }
            }
        }

        return try sentenceExamples(from: refs, folder: folder, language: language, limit: limit)
    }

    static func sentenceIndexShard(for word: String) -> String {
        var hash: UInt32 = 0
        for unit in word.utf16 {
            hash = hash &* 31 &+ UInt32(unit)
        }
        return String(format: "%02x", hash & 0xFF)
    }

    private static func firstLookupForm(_ value: String) -> String {
        value
            .components(separatedBy: CharacterSet(charactersIn: "、/;，,\n\t"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? ""
    }

    private static func uniqueLookupForms(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var output: [String] = []
        for value in values.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !value.isEmpty {
            if seen.insert(value).inserted {
                output.append(value)
            }
        }
        return output
    }

    private func sentenceReferences(word: String, folder: String) throws -> [(shard: Int, index: Int)] {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        let indexShard = Self.sentenceIndexShard(for: trimmed)
        guard
            let text = try staticAssetText(path: "\(folder)/idx/\(indexShard).json"),
            let data = text.data(using: .utf8),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rawRefs = object[trimmed] as? [[Any]]
        else { return [] }

        return rawRefs.compactMap { raw in
            guard raw.count >= 2,
                  let shard = Self.jsonInt(raw[0]),
                  let index = Self.jsonInt(raw[1])
            else { return nil }
            return (shard, index)
        }
    }

    private func sentenceExamples(
        from refs: [(shard: Int, index: Int)],
        folder: String,
        language: LanguageCode,
        limit: Int
    ) throws -> [StaticSentenceExample] {
        guard !refs.isEmpty else { return [] }
        var output: [StaticSentenceExample] = []
        var seen = Set<String>()
        let grouped = Dictionary(grouping: refs, by: \.shard)

        for shard in grouped.keys.sorted() {
            guard output.count < limit else { break }
            let path = "\(folder)/\(String(shard, radix: 16)).json"
            guard
                let text = try staticAssetText(path: path),
                let data = text.data(using: .utf8),
                let rows = try JSONSerialization.jsonObject(with: data) as? [[Any]]
            else { continue }

            for ref in grouped[shard] ?? [] {
                guard output.count < limit, rows.indices.contains(ref.index) else { continue }
                let row = rows[ref.index]
                let example: StaticSentenceExample?
                if language == .zh {
                    let simplified = Self.jsonString(row[safe: 0])
                    let traditional = Self.jsonString(row[safe: 1])
                    let english = Self.jsonString(row[safe: 2])
                    let pinyin = Self.jsonString(row[safe: 3])
                    example = simplified.isEmpty ? nil : StaticSentenceExample(
                        language: .zh,
                        text: simplified,
                        alternateText: traditional,
                        translation: english,
                        reading: pinyin,
                        source: "\(path)#\(ref.index)"
                    )
                } else {
                    let korean = Self.jsonString(row[safe: 0])
                    let english = Self.jsonString(row[safe: 1])
                    example = korean.isEmpty ? nil : StaticSentenceExample(
                        language: .ko,
                        text: korean,
                        alternateText: "",
                        translation: english,
                        reading: "",
                        source: "\(path)#\(ref.index)"
                    )
                }

                guard let example else { continue }
                let key = "\(example.language.rawValue)-\(example.text)-\(example.translation)"
                if seen.insert(key).inserted {
                    output.append(example)
                }
            }
        }

        return output
    }

    func loadGameExercise(id requestedId: Int? = nil) throws -> GameExercise? {
        guard
            let manifest = try staticAssetDecoded(GameManifestPayload.self, path: "game_unified/manifest.json"),
            let distractors = try staticAssetDecoded([String: [String]].self, path: "game_unified/distractors.json")
        else { return nil }

        let availableChunks = try staticAssetPaths(prefix: "game_unified/chunks/")
            .compactMap { path -> Int? in
                let name = URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent
                return Int(name)
            }
            .sorted()
        guard !availableChunks.isEmpty else { return nil }

        var selectedPosition = requestedId ?? -1
        var selectedSentence: GameSentencePayload?

        if let requestedId {
            let chunkIndex = requestedId / manifest.chunk_size
            let indexInChunk = requestedId % manifest.chunk_size
            guard availableChunks.contains(chunkIndex),
                  let chunk = try staticAssetDecoded([GameSentencePayload].self, path: "game_unified/chunks/\(chunkIndex).json"),
                  chunk.indices.contains(indexInChunk)
            else { return nil }
            selectedSentence = chunk[indexInChunk]
        } else {
            for _ in 0..<10 {
                guard let chunkIndex = availableChunks.randomElement(),
                      let chunk = try staticAssetDecoded([GameSentencePayload].self, path: "game_unified/chunks/\(chunkIndex).json"),
                      !chunk.isEmpty
                else { continue }
                let indexInChunk = Int.random(in: 0..<chunk.count)
                let candidate = chunk[indexInChunk]
                if Self.isSuitableGameSentence(candidate.en) {
                    selectedPosition = chunkIndex * manifest.chunk_size + indexInChunk
                    selectedSentence = candidate
                    break
                }
            }
        }

        guard let sentence = selectedSentence else { return nil }
        var exercises: [GameLanguage: GameLanguageExercise] = [:]
        for language in GameLanguage.allCases {
            guard let translation = sentence.translations[language.rawValue],
                  !translation.tokens.isEmpty
            else { continue }
            exercises[language] = Self.buildGameExercise(
                translation: translation,
                distractors: distractors[language.rawValue] ?? [],
                language: language
            )
        }
        guard !exercises.isEmpty else { return nil }

        return GameExercise(
            exerciseId: max(selectedPosition, 0),
            sourceId: sentence.id,
            english: sentence.en,
            exercises: exercises
        )
    }

    static func normalizeGameAnswer(_ value: String) -> String {
        let punctuation = CharacterSet(charactersIn: "。，、；：？！…—·「」『』（）【】《》\"\"''〈〉.,;:?!()[]\"'-–— \t\n")
        return value.unicodeScalars
            .filter { !CharacterSet.whitespacesAndNewlines.contains($0) && !punctuation.contains($0) }
            .map(String.init)
            .joined()
    }

    private static func buildGameExercise(
        translation: GameTranslationPayload,
        distractors: [String],
        language: GameLanguage
    ) -> GameLanguageExercise {
        let correctTokens = translation.tokens.filter(isValidGameToken)
        let correctSet = Set(correctTokens)
        let distractorCount = min(max(3, correctTokens.count / 2), 8)
        let selectedDistractors = shuffle(
            distractors.filter { !correctSet.contains($0) && isValidGameToken($0) }
        ).prefix(distractorCount)
        let shuffledTokens = shuffle(correctTokens + selectedDistractors)
        let tiles = shuffledTokens.enumerated().map { GameTile(id: $0.offset, text: $0.element) }
        return GameLanguageExercise(
            text: translation.text,
            tokens: correctTokens,
            tiles: tiles,
            numCorrectTiles: correctTokens.count
        )
    }

    private static func isSuitableGameSentence(_ english: String) -> Bool {
        english.range(of: #"\"\s+\""#, options: .regularExpression) == nil
    }

    private static func isValidGameToken(_ token: String) -> Bool {
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let punctuation = Set("。，、；：？！…—·「」『』（）【】《》〈〉.,;:?!()[]\"'-–— \t\n")
        if trimmed.allSatisfy({ punctuation.contains($0) }) { return false }
        if trimmed.range(of: #"^[\"\u{201C}\u{201D}'\u{2018}\u{2019}]|[\"\u{201C}\u{201D}'\u{2018}\u{2019}]$"#, options: .regularExpression) != nil {
            return false
        }
        return true
    }

    private static func shuffle<T>(_ values: [T]) -> [T] {
        var result = values
        result.shuffle()
        return result
    }

    static func decodeRecord(
        json: String,
        componentGlosses: [String: String] = [:],
        componentUses: ComponentUseIndex = [:],
        japaneseLabels: JapaneseLabelLookup = .empty
    ) -> DictionaryRecord? {
        guard
            let data = json.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let key = object["key"] as? String
        else { return nil }

        func asString(_ value: Any?) -> String {
            switch value {
            case let string as String:
                string
            case let number as NSNumber:
                number.stringValue
            default:
                ""
            }
        }

        func asObjectArray(_ value: Any?) -> [[String: Any]] {
            value as? [[String: Any]] ?? []
        }

        func stringArray(_ value: Any?) -> [String] {
            if let strings = value as? [String] { return strings }
            if let objects = value as? [[String: Any]] {
                return objects.compactMap { object in
                    let text = asString(object["text"])
                    if !text.isEmpty { return text }
                    let value = asString(object["value"])
                    return value.isEmpty ? nil : value
                }
            }
            return []
        }

        func intValue(_ value: Any?) -> Int? {
            switch value {
            case let int as Int:
                return int
            case let number as NSNumber:
                return number.intValue
            case let string as String:
                return Int(string)
            default:
                return nil
            }
        }

        func doubleValue(_ value: Any?) -> Double? {
            switch value {
            case let double as Double:
                return double
            case let number as NSNumber:
                return number.doubleValue
            case let string as String:
                return Double(string)
            default:
                return nil
            }
        }

        func boolValue(_ value: Any?) -> Bool {
            switch value {
            case let bool as Bool:
                return bool
            case let number as NSNumber:
                return number.boolValue
            case let string as String:
                return ["1", "true", "yes"].contains(string.lowercased())
            default:
                return false
            }
        }

        func unique(_ values: [String]) -> [String] {
            var seen = Set<String>()
            var output: [String] = []
            for value in values.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !value.isEmpty {
                if seen.insert(value).inserted {
                    output.append(value)
                }
            }
            return output
        }

        func cleanGloss(_ gloss: String) -> String {
            var cleaned = gloss.replacingOccurrences(
                of: #"^variant of\s+[^,;]+(\s*\[[^\]]+\])?\s*"#,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
            for marker in ["(trad/jp)", "(trad)", "(simp)", "(jp)"] {
                cleaned = cleaned.replacingOccurrences(of: marker, with: "", options: .caseInsensitive)
            }
            return cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        func glossForCharacter(_ character: String, fallback: String = "") -> String {
            let curated = componentGlosses[character].map(cleanGloss) ?? ""
            if !curated.isEmpty {
                return curated
            }
            return cleanGloss(fallback)
        }

        func componentUseGroups(for character: String) -> [CharacterComponentUseGroup] {
            guard let buckets = componentUses[character] else { return [] }
            let extraRoles = buckets.keys
                .filter { !componentUseRoleOrder.contains($0) }
                .sorted()
            return (componentUseRoleOrder + extraRoles).compactMap { role in
                guard let bucket = buckets[role], bucket.count > 0 else { return nil }
                return CharacterComponentUseGroup(
                    role: role,
                    chars: unique(bucket.chars),
                    count: bucket.count,
                    verified: bucket.verified
                )
            }
        }

        func uniqueComponents(_ components: [CharacterComponent]) -> [CharacterComponent] {
            var seen = Set<String>()
            var output: [CharacterComponent] = []
            for component in components where !component.character.isEmpty {
                let key = component.character
                if seen.insert(key).inserted {
                    output.append(component)
                }
            }
            return output
        }

        func joinForms(_ values: [String]) -> String {
            unique(values).joined(separator: "、")
        }

        func previewList(_ key: String) -> [EntryPreview] {
            asObjectArray(object[key]).map {
                EntryPreview(
                    word: asString($0["w"]),
                    reading: [asString($0["p"]), asString($0["jp"]), asString($0["kr"]), asString($0["ct"])]
                        .filter { !$0.isEmpty }
                        .joined(separator: " / "),
                    definition: asString($0["d"]),
                    isCommon: ($0["c"] as? Bool) ?? false,
                    frequencyRank: previewFrequencyRank($0["fr"])
                )
            }
            .filter { !$0.word.isEmpty }
        }

        func componentsFromIDs(_ ids: String?, startingIndex: Int = 0) -> [CharacterComponent] {
            guard let ids, !ids.isEmpty else { return [] }
            var output: [CharacterComponent] = []
            var entity = false
            for character in ids {
                if character == "&" {
                    entity = true
                    continue
                }
                if entity {
                    if character == ";" { entity = false }
                    continue
                }
                guard let scalar = character.unicodeScalars.first else { continue }
                if scalar.value >= 0x2FF0 && scalar.value <= 0x2FFB { continue }
                let text = String(character).trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty {
                    output.append(CharacterComponent(character: text, meaning: glossForCharacter(text), role: "IDS", componentIndex: startingIndex + output.count))
                }
            }
            return output
        }

        func decodeStrokeSet(from imagesValue: Any?) -> CharacterStrokeSet? {
            for image in asObjectArray(imagesValue) {
                guard let data = image["data"] as? [String: Any] else { continue }
                let strokes = stringArray(data["strokes"])
                guard !strokes.isEmpty else { continue }
                let matches = (data["matches"] as? [Any] ?? []).map { item -> [Int] in
                    if let numbers = item as? [Any] {
                        return numbers.compactMap(intValue)
                    }
                    return []
                }
                return CharacterStrokeSet(
                    source: asString(image["source"]),
                    strokes: strokes,
                    matches: matches
                )
            }
            return nil
        }

        func previewFrequencyRank(_ value: Any?) -> Int? {
            switch value {
            case let int as Int:
                return int
            case let number as NSNumber:
                return number.intValue
            case let string as String:
                return Int(string)
            default:
                return nil
            }
        }

        func isCJKUnified(_ value: String) -> Bool {
            guard value.count == 1, let scalar = value.unicodeScalars.first else { return false }
            return scalar.value >= 0x4E00 && scalar.value <= 0x9FFF
        }

        func uniqueExamples(_ values: [SentenceExample]) -> [SentenceExample] {
            var seen = Set<String>()
            var output: [SentenceExample] = []
            for value in values where !value.text.isEmpty {
                let key = "\(value.language.rawValue)-\(value.text)-\(value.translation)"
                if seen.insert(key).inserted {
                    output.append(value)
                }
            }
            return output
        }

        func exampleSource(_ source: Any?) -> String {
            if let source = source as? [String: Any] {
                return unique([asString(source["type"]), asString(source["value"])]).joined(separator: " ")
            }
            return asString(source)
        }

        func decodeJapaneseExamples(_ sense: [String: Any]) -> [SentenceExample] {
            let examples = asObjectArray(sense["examples"]).compactMap { example -> SentenceExample? in
                let sentences = asObjectArray(example["sentences"])
                let japanese = sentences.first { asString($0["land"]) == "jpn" || asString($0["lang"]) == "jpn" }
                let english = sentences.first { asString($0["land"]) == "eng" || asString($0["lang"]) == "eng" }
                let text = asString(japanese?["text"])
                guard !text.isEmpty else { return nil }
                return SentenceExample(
                    language: .ja,
                    text: text,
                    translation: asString(english?["text"]),
                    source: exampleSource(example["source"])
                )
            }
            return uniqueExamples(examples)
        }

        func decodeJapaneseExamples(_ senses: [[String: Any]]) -> [SentenceExample] {
            uniqueExamples(senses.flatMap { decodeJapaneseExamples($0) })
        }

        func decodeKoreanExamples(_ word: [String: Any]) -> [SentenceExample] {
            let examples = asObjectArray(word["examples"]).compactMap { example -> SentenceExample? in
                let text = asString(example["korean"]).isEmpty ? asString(example["kr"]) : asString(example["korean"])
                guard !text.isEmpty else { return nil }
                return SentenceExample(
                    language: .ko,
                    text: text,
                    translation: asString(example["translation"]).isEmpty ? asString(example["en"]) : asString(example["translation"]),
                    source: exampleSource(example["source"])
                )
            }
            return uniqueExamples(examples)
        }

        func decodeJapaneseTextReferences(_ value: Any?) -> [JapaneseTextReference] {
            asObjectArray(value).compactMap { item in
                let text = asString(item["text"])
                guard !text.isEmpty else { return nil }
                return JapaneseTextReference(text: text, type: asString(item["type"]))
            }
        }

        func decodeChineseStatistics(_ value: Any?) -> ChineseWordStatistics? {
            guard let stats = value as? [String: Any] else { return nil }
            return ChineseWordStatistics(
                movieWordRank: intValue(stats["movieWordRank"]),
                movieWordCount: intValue(stats["movieWordCount"]),
                movieWordCountPercent: doubleValue(stats["movieWordCountPercent"]),
                bookWordRank: intValue(stats["bookWordRank"]),
                bookWordCount: intValue(stats["bookWordCount"]),
                bookWordCountPercent: doubleValue(stats["bookWordCountPercent"])
            )
        }

        let chineseWordObjects = asObjectArray(object["chinese_words"])
        let japaneseWordObjects = asObjectArray(object["japanese_words"])
        let koreanWordObjects = asObjectArray(object["korean_words"])

        let chineseWordEntries = chineseWordObjects.map { word -> ChineseWordEntry in
            let items = asObjectArray(word["items"]).map { item in
                ChineseWordItem(
                    source: asString(item["source"]),
                    pinyin: asString(item["pinyin"]),
                    jyutping: asString(item["jyutping"]),
                    simplifiedTraditional: asString(item["simpTrad"]),
                    definitions: stringArray(item["definitions"]),
                    tang: stringArray(item["tang"]),
                    variantRefs: stringArray(item["variantRefs"])
                )
            }
            let generatedId = unique([asString(word["_id"]), asString(word["trad"]), asString(word["simp"])]).joined(separator: "-")
            return ChineseWordEntry(
                id: generatedId.isEmpty ? UUID().uuidString : generatedId,
                simplified: asString(word["simp"]),
                traditional: asString(word["trad"]),
                items: items,
                gloss: asString(word["gloss"]),
                pinyinSearchString: asString(word["pinyinSearchString"]),
                jyutpingSearchString: asString(word["jyutpingSearchString"]),
                statistics: decodeChineseStatistics(word["statistics"])
            )
        }

        let japaneseWordEntries = japaneseWordObjects.map { word -> JapaneseWordEntry in
            let kanji = asObjectArray(word["kanji"]).map { headword in
                JapaneseHeadword(
                    kind: .kanji,
                    text: asString(headword["text"]),
                    isCommon: boolValue(headword["common"]),
                    tags: stringArray(headword["tags"]),
                    appliesTo: stringArray(headword["appliesToKanji"]),
                    pitchAccents: (headword["pitchAccents"] as? [Any] ?? []).compactMap(intValue)
                )
            }.filter { !$0.text.isEmpty }
            let kana = asObjectArray(word["kana"]).map { headword in
                JapaneseHeadword(
                    kind: .kana,
                    text: asString(headword["text"]),
                    isCommon: boolValue(headword["common"]),
                    tags: stringArray(headword["tags"]),
                    appliesTo: stringArray(headword["appliesToKanji"]),
                    pitchAccents: (headword["pitchAccents"] as? [Any] ?? []).compactMap(intValue)
                )
            }.filter { !$0.text.isEmpty }
            let senses = asObjectArray(word["sense"]).enumerated().map { index, sense in
                JapaneseSenseSummary(
                    id: "\(asString(word["id"]))-\(index)",
                    partOfSpeech: stringArray(sense["partOfSpeech"]),
                    appliesToKanji: stringArray(sense["appliesToKanji"]),
                    appliesToKana: stringArray(sense["appliesToKana"]),
                    related: decodeJapaneseTextReferences(sense["related"]),
                    antonyms: decodeJapaneseTextReferences(sense["antonym"]),
                    field: stringArray(sense["field"]),
                    dialect: stringArray(sense["dialect"]),
                    misc: stringArray(sense["misc"]),
                    info: stringArray(sense["info"]),
                    languageSource: asObjectArray(sense["languageSource"]).map {
                        JapaneseLanguageSourceSummary(
                            lang: asString($0["lang"]),
                            text: asString($0["text"]),
                            isFull: boolValue($0["full"]),
                            isWasei: boolValue($0["wasei"])
                        )
                    },
                    glosses: asObjectArray(sense["gloss"]).map {
                        JapaneseGlossSummary(
                            lang: asString($0["lang"]),
                            gender: asString($0["gender"]),
                            type: asString($0["type"]),
                            text: asString($0["text"])
                        )
                    }.filter { !$0.text.isEmpty },
                    examples: decodeJapaneseExamples(sense)
                )
            }
            let generatedId = unique([asString(word["id"]), kanji.map(\.text).joined(separator: ","), kana.map(\.text).joined(separator: ",")]).joined(separator: "-")
            return JapaneseWordEntry(
                id: generatedId.isEmpty ? UUID().uuidString : generatedId,
                kanji: kanji,
                kana: kana,
                senses: senses
            )
        }

        let koreanWordEntries = koreanWordObjects.map { word -> KoreanWordEntry in
            KoreanWordEntry(
                id: asString(word["id"]).isEmpty ? UUID().uuidString : asString(word["id"]),
                hangul: asString(word["hangul"]),
                hanja: asString(word["hanja"]),
                romanization: asString(word["romanization"]),
                pronunciation: asString(word["pronunciation"]),
                partOfSpeech: asString(word["pos"]),
                definitions: asObjectArray(word["definitions"]).compactMap {
                    let text = asString($0["text"])
                    guard !text.isEmpty else { return nil }
                    return KoreanDefinitionSummary(
                        text: text,
                        language: asString($0["lang"]),
                        senseNumber: intValue($0["sense_number"])
                    )
                },
                examples: asObjectArray(word["examples"]).compactMap {
                    let korean = asString($0["korean"]).isEmpty ? asString($0["kr"]) : asString($0["korean"])
                    guard !korean.isEmpty else { return nil }
                    return KoreanExampleSummary(
                        korean: korean,
                        translation: asString($0["translation"]).isEmpty ? asString($0["en"]) : asString($0["translation"])
                    )
                },
                origin: asString(word["origin"]),
                frequencyRank: intValue(word["frequencyRank"] ?? word["frequency_rank"])
            )
        }

        func decodeSimpleSections(_ language: LanguageCode, _ key: String) -> [WordSection] {
            guard let items = object[key] as? [[String: Any]] else { return [] }
            return items.map {
                WordSection(
                    language: language,
                    headword: $0["headword"] as? String ?? "",
                    reading: $0["reading"] as? String ?? "",
                    definitions: $0["definitions"] as? [String] ?? [],
                    tags: $0["tags"] as? [String] ?? []
                )
            }
        }

        func firstPronunciation(_ values: [String], splitSpaces: Bool) -> String {
            let separators = splitSpaces ? "/,;，、 \n\t" : "/,;，、\n\t"
            for value in values {
                let candidates = value
                    .components(separatedBy: CharacterSet(charactersIn: separators))
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                if let first = candidates.first {
                    return first
                }
            }
            return ""
        }

        let chineseWordSections = chineseWordObjects.map { word -> WordSection in
            let simp = asString(word["simp"])
            let trad = asString(word["trad"])
            let headword = joinForms([trad, simp].filter { !$0.isEmpty })
            let items = asObjectArray(word["items"])
            let definitions = unique(items.flatMap { stringArray($0["definitions"]) } + [asString(word["gloss"])])
            let pinyin = firstPronunciation(
                items.map { asString($0["pinyin"]) } + [asString(word["pinyinSearchString"])],
                splitSpaces: true
            )
            let jyutping = firstPronunciation(
                items.map { asString($0["jyutping"]) } + [asString(word["jyutpingSearchString"])],
                splitSpaces: false
            )
            let tags = unique(items.map { asString($0["source"]) })
            return WordSection(
                language: .zh,
                headword: headword.isEmpty ? key : headword,
                reading: joinedUnique([pinyin, jyutping], separator: " · "),
                definitions: definitions.isEmpty ? ["No English gloss in local record"] : definitions,
                tags: tags
            )
        }

        let japaneseWordSections = japaneseWordEntries.map { entry -> WordSection in
            entry.flattenedSection()
        }

        let koreanWordSections = koreanWordEntries.map { entry -> WordSection in
            entry.flattenedSection()
        }

        func decodeChineseCharacter(_ value: Any?) -> CharacterSummary? {
            guard let char = value as? [String: Any] else { return nil }
            let form = asString(char["char"])
            guard !form.isEmpty else { return nil }
            let stats = char["statistics"] as? [String: Any] ?? [:]
            let componentObjects = asObjectArray(char["components"])
            let components = componentObjects.enumerated().compactMap { index, component -> CharacterComponent? in
                let componentChar = asString(component["character"]).isEmpty ? asString(component["char"]) : asString(component["character"])
                guard !componentChar.isEmpty else { return nil }
                let types = stringArray(component["componentType"]).isEmpty ? stringArray(component["type"]) : stringArray(component["componentType"])
                let dictionaryMeaning = asString(component["meaning"])
                return CharacterComponent(
                    character: componentChar,
                    meaning: glossForCharacter(componentChar, fallback: dictionaryMeaning),
                    role: types.joined(separator: ", "),
                    dictionaryMeaning: dictionaryMeaning,
                    pinyin: asString(component["pinyin"]),
                    hint: asString(component["hint"]),
                    componentIndex: index
                )
            } + componentsFromIDs(asString(char["ids"]), startingIndex: componentObjects.count)
            let pinyin = asObjectArray(char["pinyinFrequencies"]).map { asString($0["pinyin"]) }
            var tags = unique([
                asString(char["codepoint"]),
                asString(char["strokeCount"]).isEmpty ? "" : "\(asString(char["strokeCount"])) strokes"
            ])
            if let hsk = stats["hskLevel"] { tags.append("HSK \(asString(hsk))") }
            if (char["isVerified"] as? Bool) == true { tags.append("verified") }

            let variants = asObjectArray(char["variants"]).compactMap { variant -> CharacterVariantSummary? in
                let character = asString(variant["char"])
                let parts = asString(variant["parts"])
                let display = character.isEmpty ? parts : character
                guard !display.isEmpty else { return nil }
                return CharacterVariantSummary(
                    character: display,
                    label: parts.isEmpty ? "variant" : parts,
                    source: asString(variant["source"])
                )
            } + [
                CharacterVariantSummary(character: asString(char["variantOf"]), label: "variant of", source: ""),
                CharacterVariantSummary(character: asString(char["hkChar"]), label: "Hong Kong", source: ""),
            ].filter { !$0.character.isEmpty }
            let topWords = asObjectArray(stats["topWords"]).compactMap { item -> CharacterTopWord? in
                let word = asString(item["word"])
                guard !word.isEmpty else { return nil }
                return CharacterTopWord(
                    word: word,
                    traditional: asString(item["trad"]),
                    gloss: asString(item["gloss"]),
                    share: doubleValue(item["share"])
                )
            }
            let oldPronunciations = asObjectArray(char["oldPronunciations"]).compactMap { item -> CharacterPronunciationHistory? in
                let pinyin = asString(item["pinyin"])
                guard !pinyin.isEmpty else { return nil }
                return CharacterPronunciationHistory(
                    pinyin: pinyin,
                    source: asString(item["source"]),
                    gloss: asString(item["gloss"]),
                    middleChinese: asString(item["MC"]),
                    oldChinese: asString(item["OC"]),
                    dynasty: asString(item["dynasty"])
                )
            }
            let comments = asObjectArray(char["comments"]).compactMap { item -> CharacterComment? in
                let comment = asString(item["comment"])
                guard !comment.isEmpty else { return nil }
                return CharacterComment(comment: comment, source: asString(item["source"]))
            }
            let images = asObjectArray(char["images"]).compactMap { item -> CharacterImageReference? in
                let url = asString(item["url"])
                guard !url.isEmpty else { return nil }
                return CharacterImageReference(
                    url: url,
                    type: asString(item["type"]),
                    era: asString(item["era"]),
                    strokeSet: decodeStrokeSet(from: [item])
                )
            }
            let pinyinFacts = asObjectArray(char["pinyinFrequencies"]).compactMap { item -> String? in
                let pinyin = asString(item["pinyin"])
                guard !pinyin.isEmpty else { return nil }
                let count = asString(item["count"])
                return count.isEmpty ? pinyin : "\(pinyin) (\(count))"
            }
            let facts = [
                CharacterFact(label: "Codepoint", value: asString(char["codepoint"])),
                CharacterFact(label: "Sources", value: stringArray(char["sources"]).joined(separator: ", ")),
                CharacterFact(label: "Pinyin frequency", value: pinyinFacts.joined(separator: ", ")),
                CharacterFact(label: "Cantonese", value: stringArray(char["cantonese"]).joined(separator: ", ")),
                CharacterFact(label: "IDS", value: asString(char["ids"])),
                CharacterFact(label: "Apparent IDS", value: asString(char["idsApparent"])),
                CharacterFact(label: "Movie count", value: asString(stats["movieCharCount"])),
                CharacterFact(label: "Book count", value: asString(stats["bookCharCount"]))
            ].filter { !$0.value.isEmpty }
            return CharacterSummary(
                language: .zh,
                form: form,
                variantLabel: "Chinese character",
                readings: unique(pinyin + stringArray(char["cantonese"])),
                meanings: unique([asString(char["gloss"])]),
                tags: tags,
                components: uniqueComponents(components),
                componentUses: componentUseGroups(for: form),
                notes: unique([asString(char["hint"]), asString(char["shuowen"]), asString(char["variantOf"]).isEmpty ? "" : "Variant of \(asString(char["variantOf"]))"]),
                facts: facts,
                variants: variants,
                topWords: topWords,
                oldPronunciations: oldPronunciations,
                comments: comments,
                images: images,
                strokeSet: decodeStrokeSet(from: char["images"])
            )
        }

        func decodeJapaneseCharacter(_ value: Any?) -> CharacterSummary? {
            guard let char = value as? [String: Any] else { return nil }
            let form = asString(char["literal"])
            guard !form.isEmpty else { return nil }
            let readingMeaning = char["readingMeaning"] as? [String: Any] ?? [:]
            let groups = asObjectArray(readingMeaning["readingGroups"]).isEmpty ? asObjectArray(readingMeaning["groups"]) : asObjectArray(readingMeaning["readingGroups"])
            let readings = groups.flatMap { group -> [String] in
                asObjectArray(group["readings"]).map { reading in
                    let type = asString(reading["type"])
                    let value = asString(reading["value"])
                    return type.isEmpty ? value : "\(type): \(value)"
                }
            }
            let meanings = groups.flatMap { group -> [String] in
                stringArray(group["meanings"])
            }
            let misc = char["misc"] as? [String: Any] ?? [:]
            let strokeCounts = (misc["strokeCounts"] as? [Any] ?? []).map(asString)
            var tags = strokeCounts.map { "\($0) strokes" }
            if let grade = misc["grade"] { tags.append("grade \(asString(grade))") }
            if let jlpt = misc["jlptLevel"] { tags.append("JLPT N\(asString(jlpt))") }
            if let frequency = misc["frequency"] { tags.append("frequency \(asString(frequency))") }
            let radicals = asObjectArray(char["radicals"]).map { "radical \(asString($0["value"]))" }
            let facts =
                asObjectArray(char["codepoints"]).map { CharacterFact(label: asString($0["type"]).isEmpty ? "Codepoint" : asString($0["type"]), value: asString($0["value"])) } +
                asObjectArray(char["dictionaryReferences"]).map { CharacterFact(label: asString($0["type"]).isEmpty ? "Dictionary" : asString($0["type"]), value: asString($0["value"])) } +
                asObjectArray(char["queryCodes"]).map { CharacterFact(label: asString($0["type"]).isEmpty ? "Query code" : asString($0["type"]), value: asString($0["value"])) }
            let variants = asObjectArray(misc["variants"]).compactMap { variant -> CharacterVariantSummary? in
                let value = asString(variant["value"])
                guard !value.isEmpty else { return nil }
                return CharacterVariantSummary(character: value, label: asString(variant["type"]), source: "kanjidic")
            }
            return CharacterSummary(
                language: .ja,
                form: form,
                variantLabel: "Japanese kanji",
                readings: unique(readings),
                meanings: unique(meanings),
                tags: unique(tags + radicals + stringArray(misc["radicalNames"])),
                components: uniqueComponents(componentsFromIDs(asString(char["ids"]))),
                componentUses: componentUseGroups(for: form),
                notes: unique([asString(char["ids"]), asString(char["idsApparent"])]),
                facts: facts.filter { !$0.value.isEmpty },
                variants: variants
            )
        }

        func decodeKoreanCharacter(_ value: Any?) -> CharacterSummary? {
            guard let char = value as? [String: Any] else { return nil }
            let form = asString(char["hanjaForm"]).isEmpty ? asString(char["character"]) : asString(char["hanjaForm"])
            guard !form.isEmpty else { return nil }
            let readings = asObjectArray(char["readings"]).map { reading -> String in
                let hangul = asString(reading["hangul"])
                let romanization = asString(reading["romanization"])
                return romanization.isEmpty ? hangul : "\(hangul) \(romanization)"
            }
            return CharacterSummary(
                language: .ko,
                form: form,
                variantLabel: "Korean hanja",
                readings: unique(readings),
                meanings: unique(stringArray(char["meaningsEn"]) + stringArray(char["meanings"])),
                tags: unique([
                    asString(char["strokes"]).isEmpty ? "" : "\(asString(char["strokes"])) strokes",
                    asString(char["radical"]).isEmpty ? "" : "radical \(asString(char["radical"]))"
                ]),
                components: [],
                componentUses: componentUseGroups(for: form),
                notes: [],
                facts: [
                    CharacterFact(label: "Canonical", value: asString(char["character"])),
                    CharacterFact(label: "Hanja form", value: asString(char["hanjaForm"])),
                    CharacterFact(label: "Radical", value: asString(char["radical"]))
                ].filter { !$0.value.isEmpty }
            )
        }

        let names = asObjectArray(object["japanese_names"]).map { name -> JapaneseNameSummary in
            let translations = asObjectArray(name["translation"])
            return JapaneseNameSummary(
                id: asString(name["id"]).isEmpty ? UUID().uuidString : asString(name["id"]),
                kanji: asObjectArray(name["kanji"]).map { asString($0["text"]) }.filter { !$0.isEmpty },
                kana: asObjectArray(name["kana"]).map { asString($0["text"]) }.filter { !$0.isEmpty },
                translations: unique(translations.flatMap { translation in
                    asObjectArray(translation["translation"]).map { asString($0["text"]) }
                }),
                tags: unique(translations.flatMap { stringArray($0["type"]) })
            )
        }

        let characters = [
            decodeChineseCharacter(object["chinese_char"]),
            decodeJapaneseCharacter(object["japanese_char"]),
            decodeKoreanCharacter(object["korean_char"])
        ].compactMap { $0 }

        func similarCharactersForRecord() -> [SimilarCharacter] {
            let targetComponents = unique(characters.flatMap { $0.components.map(\.character) })
            guard !targetComponents.isEmpty else { return [] }

            var candidates: [String: Set<String>] = [:]
            for component in targetComponents {
                guard let buckets = componentUses[component] else { continue }
                for bucket in buckets.values {
                    for candidate in bucket.chars where candidate != key && isCJKUnified(candidate) {
                        candidates[candidate, default: []].insert(component)
                    }
                }
            }

            return candidates.map { character, shared in
                SimilarCharacter(
                    character: character,
                    sharedComponents: Array(shared).sorted(),
                    score: shared.count,
                    gloss: glossForCharacter(character)
                )
            }
            .sorted {
                if $0.score != $1.score { return $0.score > $1.score }
                if !$0.gloss.isEmpty && $1.gloss.isEmpty { return true }
                if $0.gloss.isEmpty && !$1.gloss.isEmpty { return false }
                return $0.character < $1.character
            }
            .prefix(20)
            .map { $0 }
        }

        let similarCharacters = similarCharactersForRecord()

        let related = unique(
            stringArray(object["related"]) +
            stringArray(object["related_japanese_words"])
        )

        return DictionaryRecord(
            key: key,
            redirect: object["redirect"] as? String,
            chinese: decodeSimpleSections(.zh, "chinese") + chineseWordSections,
            japanese: decodeSimpleSections(.ja, "japanese") + japaneseWordSections,
            korean: decodeSimpleSections(.ko, "korean") + koreanWordSections,
            chineseWordEntries: chineseWordEntries,
            japaneseWordEntries: japaneseWordEntries,
            koreanWordEntries: koreanWordEntries,
            characters: characters,
            japaneseNames: names,
            contains: previewList("contains"),
            containedInChinese: previewList("contained_in_chinese"),
            containedInJapanese: previewList("contained_in_japanese"),
            containedInKorean: previewList("contained_in_korean"),
            similarCharacters: similarCharacters,
            related: related,
            rawJSON: json,
            japaneseLabels: japaneseLabels
        )
    }

    func listNotes() throws -> [UserNote] {
        try queryRows("""
        SELECT id, userId, character, noteText, isAdmin, createdAt, updatedAt, dirty, deleted
        FROM notes
        WHERE userId = ? AND deleted = 0
        ORDER BY updatedAt DESC
        """, [.text(Self.currentUserId)]).map {
            UserNote(
                id: $0["id"] ?? "",
                userId: $0["userId"] ?? "",
                character: $0["character"] ?? "",
                noteText: $0["noteText"] ?? "",
                isAdmin: $0["isAdmin"] == "1",
                createdAt: Self.date(fromMillis: $0["createdAt"]),
                updatedAt: Self.date(fromMillis: $0["updatedAt"]),
                dirty: $0["dirty"] == "1",
                deleted: $0["deleted"] == "1"
            )
        }
    }

    func listEntryNotes(keys: [String]) throws -> [UserNote] {
        let normalized = uniqueNonEmpty(keys.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) })
        guard !normalized.isEmpty else { return [] }
        let placeholders = Array(repeating: "?", count: normalized.count).joined(separator: ", ")
        let values = normalized.map(SQLiteValue.text)
        return try queryRows("""
        SELECT id, userId, character, noteText, isAdmin, createdAt, updatedAt, dirty, deleted
        FROM notes
        WHERE deleted = 0 AND character IN (\(placeholders))
        ORDER BY isAdmin DESC, updatedAt DESC
        """, values).map {
            UserNote(
                id: $0["id"] ?? "",
                userId: $0["userId"] ?? "",
                character: $0["character"] ?? "",
                noteText: $0["noteText"] ?? "",
                isAdmin: $0["isAdmin"] == "1",
                createdAt: Self.date(fromMillis: $0["createdAt"]),
                updatedAt: Self.date(fromMillis: $0["updatedAt"]),
                dirty: $0["dirty"] == "1",
                deleted: $0["deleted"] == "1"
            )
        }
    }

    func storeNoteImage(character: String, imageData: Data) throws -> String {
        let support = try noteImageDirectory()
        let id = UUID().uuidString
        let upload = Self.syncImageUpload(from: imageData)
        let imageURL = support.appendingPathComponent("\(id).jpg")
        try upload.data.write(to: imageURL, options: .atomic)
        let alt = character.isEmpty ? "Note image" : "\(character) note image"
        return "![\(alt)](\(Self.noteImageMarker(id: id)))"
    }

    func localNoteImageURL(id: String) -> URL? {
        guard !id.isEmpty else { return nil }
        return url.deletingLastPathComponent()
            .appendingPathComponent("NoteImages", isDirectory: true)
            .appendingPathComponent("\(id).jpg")
    }

    func upsertNote(character: String, text: String) throws {
        let now = Self.nowMillis()
        let id = UUID().uuidString
        try run("""
        INSERT INTO notes (id, userId, character, noteText, isAdmin, createdAt, updatedAt, dirty, deleted)
        VALUES (?, ?, ?, ?, 0, ?, ?, 1, 0)
        ON CONFLICT(userId, character) DO UPDATE SET
            noteText = excluded.noteText,
            updatedAt = excluded.updatedAt,
            dirty = 1,
            deleted = 0
        """, [.text(id), .text(Self.currentUserId), .text(character), .text(text), .int(now), .int(now)])
        try enqueue(
            entity: "note",
            entityId: character,
            operation: "upsert",
            payload: Self.jsonPayload([
                "id": id,
                "character": character,
                "noteText": text,
                "noteImages": noteImageUploadPayloads(from: text),
                "createdAt": now,
                "updatedAt": now
            ])
        )
    }

    private func noteImageDirectory() throws -> URL {
        let support = url.deletingLastPathComponent().appendingPathComponent("NoteImages", isDirectory: true)
        try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        return support
    }

    private func noteImageUploadPayloads(from text: String) -> [[String: Any]] {
        var seen = Set<String>()
        var payloads: [[String: Any]] = []

        for marker in Self.localNoteImageMarkers(in: text) where !seen.contains(marker) {
            seen.insert(marker)
            guard
                let id = Self.noteImageId(from: marker),
                let fileURL = localNoteImageURL(id: id),
                let imageData = try? Data(contentsOf: fileURL)
            else { continue }

            let upload = Self.syncImageUpload(from: imageData)
            guard upload.data.count <= 5 * 1024 * 1024 else { continue }
            payloads.append([
                "id": id,
                "marker": marker,
                "imageDataBase64": upload.data.base64EncodedString(),
                "contentType": upload.contentType
            ])
        }

        return payloads
    }

    func markNoteDeleted(id: String) throws {
        let now = Self.nowMillis()
        let character = try scalarText("SELECT character FROM notes WHERE id = ?", [.text(id)]) ?? id
        try run("UPDATE notes SET deleted = 1, dirty = 1, updatedAt = ? WHERE id = ?", [.int(now), .text(id)])
        try enqueue(
            entity: "note",
            entityId: id,
            operation: "delete",
            payload: Self.jsonPayload(["id": id, "character": character, "updatedAt": now])
        )
    }

    func listStudyCards() throws -> [StudyCard] {
        try queryRows("""
        SELECT id, userId, word, language, easeFactor, interval, repetitions, nextReview, lastReviewed, createdAt, updatedAt, dirty
        FROM study_cards
        WHERE userId = ? AND deleted = 0
        ORDER BY nextReview ASC, createdAt DESC
        """, [.text(Self.currentUserId)]).map {
            StudyCard(
                id: $0["id"] ?? "",
                userId: $0["userId"] ?? "",
                word: $0["word"] ?? "",
                language: LanguageCode(rawValue: $0["language"] ?? "ja") ?? .ja,
                easeFactor: Int($0["easeFactor"] ?? "250") ?? 250,
                interval: Int($0["interval"] ?? "0") ?? 0,
                repetitions: Int($0["repetitions"] ?? "0") ?? 0,
                nextReview: Self.date(fromMillis: $0["nextReview"]),
                lastReviewed: Self.optionalDate(fromMillis: $0["lastReviewed"]),
                createdAt: Self.date(fromMillis: $0["createdAt"]),
                updatedAt: Self.date(fromMillis: $0["updatedAt"]),
                dirty: $0["dirty"] == "1"
            )
        }
    }

    func addStudyCard(word: String, language: LanguageCode) throws {
        let now = Self.nowMillis()
        let id = "sc_\(now)_\(UUID().uuidString.prefix(8))"
        try run("""
        INSERT INTO study_cards (id, userId, word, language, easeFactor, interval, repetitions, nextReview, lastReviewed, createdAt, updatedAt, dirty, deleted)
        VALUES (?, ?, ?, ?, 250, 0, 0, ?, NULL, ?, ?, 1, 0)
        ON CONFLICT(userId, word) DO UPDATE SET deleted = 0, dirty = 1, updatedAt = excluded.updatedAt
        """, [.text(id), .text(Self.currentUserId), .text(word), .text(language.rawValue), .int(now), .int(now), .int(now)])
        try enqueue(
            entity: "studyCard",
            entityId: word,
            operation: "upsert",
            payload: Self.jsonPayload([
                "id": id,
                "word": word,
                "language": language.rawValue,
                "createdAt": now,
                "updatedAt": now
            ])
        )
    }

    func review(card: StudyCard, rating: ReviewRating) throws {
        let next = Self.calculateNextReview(card: card, rating: rating)
        let now = Self.nowMillis()
        try run("""
        UPDATE study_cards SET
            easeFactor = ?,
            interval = ?,
            repetitions = ?,
            nextReview = ?,
            lastReviewed = ?,
            updatedAt = ?,
            dirty = 1
        WHERE id = ?
        """, [
            .int(Int64(next.easeFactor)),
            .int(Int64(next.interval)),
            .int(Int64(next.repetitions)),
            .int(Self.millis(from: next.nextReview)),
            .int(now),
            .int(now),
            .text(card.id)
        ])
        try enqueue(
            entity: "studyReview",
            entityId: card.word,
            operation: "review",
            payload: Self.jsonPayload(["word": card.word, "rating": rating.rawValue, "updatedAt": now])
        )
    }

    func reset(card: StudyCard) throws {
        let now = Self.nowMillis()
        try run("""
        UPDATE study_cards
        SET easeFactor = 250, interval = 0, repetitions = 0, nextReview = ?, lastReviewed = NULL, updatedAt = ?, dirty = 1
        WHERE id = ?
        """, [.int(now), .int(now), .text(card.id)])
        try enqueue(
            entity: "studyCard",
            entityId: card.word,
            operation: "reset",
            payload: Self.jsonPayload(["id": card.id, "word": card.word, "updatedAt": now])
        )
    }

    func deleteStudyCard(id: String) throws {
        let now = Self.nowMillis()
        let word = try scalarText("SELECT word FROM study_cards WHERE id = ?", [.text(id)]) ?? id
        try run("UPDATE study_cards SET deleted = 1, dirty = 1, updatedAt = ? WHERE id = ?", [.int(now), .text(id)])
        try enqueue(
            entity: "studyCard",
            entityId: id,
            operation: "delete",
            payload: Self.jsonPayload(["id": id, "word": word, "updatedAt": now])
        )
    }

    static func calculateNextReview(card: StudyCard, rating: ReviewRating) -> (easeFactor: Int, interval: Int, repetitions: Int, nextReview: Date) {
        var easeFactor = Double(card.easeFactor) / 100.0
        var interval = card.interval
        var repetitions = card.repetitions
        let quality = rating.quality

        if quality < 3 {
            repetitions = 0
            interval = 0
        } else {
            if repetitions == 0 {
                interval = 1
            } else if repetitions == 1 {
                interval = 6
            } else {
                interval = Int(round(Double(interval) * easeFactor))
            }
            repetitions += 1
        }

        easeFactor += 0.1 - Double(5 - quality) * (0.08 + Double(5 - quality) * 0.02)
        easeFactor = max(1.3, easeFactor)

        if rating == .again {
            interval = 0
        } else if rating == .hard && interval > 1 {
            interval = max(1, Int(round(Double(interval) * 0.8)))
        } else if rating == .easy {
            interval = Int(round(Double(interval) * 1.3))
        }

        let next = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: interval, to: Date()) ?? Date())
        return (Int(round(easeFactor * 100)), interval, repetitions, next)
    }

    func listCustomWords() throws -> [CustomWord] {
        try queryRows("""
        SELECT id, userId, word, language, reading, definitions, notes, createdAt, updatedAt, dirty
        FROM custom_words
        WHERE userId = ? AND deleted = 0
        ORDER BY updatedAt DESC
        """, [.text(Self.currentUserId)]).map {
            CustomWord(
                id: $0["id"] ?? "",
                userId: $0["userId"] ?? "",
                word: $0["word"] ?? "",
                language: LanguageCode(rawValue: $0["language"] ?? "ja") ?? .ja,
                reading: $0["reading"] ?? "",
                definitions: Self.decodeStringArray($0["definitions"]),
                notes: $0["notes"] ?? "",
                createdAt: Self.date(fromMillis: $0["createdAt"]),
                updatedAt: Self.date(fromMillis: $0["updatedAt"]),
                dirty: $0["dirty"] == "1"
            )
        }
    }

    func upsertCustomWord(_ draft: CustomWordDraft) throws {
        let now = Self.nowMillis()
        let id = UUID().uuidString
        let definitions = draft.definitions
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let encoded = Self.encodeStringArray(definitions)
        try run("""
        INSERT INTO custom_words (id, userId, word, language, reading, definitions, notes, createdAt, updatedAt, dirty, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        ON CONFLICT(word) DO UPDATE SET
            language = excluded.language,
            reading = excluded.reading,
            definitions = excluded.definitions,
            notes = excluded.notes,
            updatedAt = excluded.updatedAt,
            dirty = 1,
            deleted = 0
        """, [.text(id), .text(Self.currentUserId), .text(draft.word), .text(draft.language.rawValue), .text(draft.reading), .text(encoded), .text(draft.notes), .int(now), .int(now)])
        try enqueue(
            entity: "customWord",
            entityId: draft.word,
            operation: "upsert",
            payload: Self.jsonPayload([
                "id": id,
                "word": draft.word,
                "language": draft.language.rawValue,
                "reading": draft.reading,
                "definitions": definitions,
                "notes": draft.notes,
                "createdAt": now,
                "updatedAt": now
            ])
        )
    }

    func listArtifacts() throws -> [Artifact] {
        let rows = try queryRows("""
        SELECT
            a.id, a.userId, a.title, a.description, a.language, a.type, a.isPublic, a.createdAt, a.updatedAt, a.dirty,
            (SELECT imagePath FROM artifact_images WHERE artifactId = a.id AND deleted = 0 ORDER BY sortOrder LIMIT 1) AS thumbnailPath,
            (SELECT count(*) FROM artifact_sentences WHERE artifactId = a.id AND deleted = 0) AS sentenceCount
        FROM artifacts a
        WHERE a.userId = ? AND a.deleted = 0
        ORDER BY a.updatedAt DESC
        """, [.text(Self.currentUserId)])
        return rows.map {
            Artifact(
                id: $0["id"] ?? "",
                userId: $0["userId"] ?? "",
                title: $0["title"] ?? "",
                description: $0["description"] ?? "",
                language: LanguageCode(rawValue: $0["language"] ?? "ja") ?? .ja,
                type: $0["type"] ?? "other",
                isPublic: $0["isPublic"] == "1",
                thumbnailPath: $0["thumbnailPath"],
                sentenceCount: Int($0["sentenceCount"] ?? "0") ?? 0,
                createdAt: Self.date(fromMillis: $0["createdAt"]),
                updatedAt: Self.date(fromMillis: $0["updatedAt"]),
                dirty: $0["dirty"] == "1"
            )
        }
    }

    func createArtifact(_ draft: ArtifactDraft) throws {
        let now = Self.nowMillis()
        let id = UUID().uuidString
        try run("""
        INSERT INTO artifacts (id, userId, title, description, language, type, isPublic, createdAt, updatedAt, dirty, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        """, [.text(id), .text(Self.currentUserId), .text(draft.title), .text(draft.description), .text(draft.language.rawValue), .text(draft.type), .int(draft.isPublic ? 1 : 0), .int(now), .int(now)])
        try enqueue(
            entity: "artifact",
            entityId: id,
            operation: "upsert",
            payload: Self.jsonPayload([
                "id": id,
                "title": draft.title,
                "description": draft.description,
                "language": draft.language.rawValue,
                "type": draft.type,
                "isPublic": draft.isPublic,
                "createdAt": now,
                "updatedAt": now
            ])
        )
    }

    func listArtifactSentences(artifactId: String) throws -> [ArtifactSentence] {
        try queryRows("""
        SELECT id, artifactId, originalText, translation, sortOrder, createdAt
        FROM artifact_sentences
        WHERE artifactId = ? AND deleted = 0
        ORDER BY sortOrder, createdAt
        """, [.text(artifactId)]).map {
            ArtifactSentence(
                id: $0["id"] ?? "",
                artifactId: $0["artifactId"] ?? "",
                originalText: $0["originalText"] ?? "",
                translation: $0["translation"] ?? "",
                sortOrder: Int($0["sortOrder"] ?? "0") ?? 0,
                createdAt: Self.date(fromMillis: $0["createdAt"])
            )
        }
    }

    func listArtifactMentions(word: String) throws -> [ArtifactMention] {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        let likePattern = Self.escapedLikePattern(containing: trimmed)
        let rows = try queryRows("""
        SELECT
            a.id AS artifactId,
            a.userId AS artifactUserId,
            a.title AS artifactTitle,
            a.description AS artifactDescription,
            a.language AS artifactLanguage,
            a.type AS artifactType,
            a.isPublic AS artifactIsPublic,
            a.createdAt AS artifactCreatedAt,
            a.updatedAt AS artifactUpdatedAt,
            a.dirty AS artifactDirty,
            (SELECT imagePath FROM artifact_images WHERE artifactId = a.id AND deleted = 0 ORDER BY sortOrder LIMIT 1) AS thumbnailPath,
            (SELECT count(*) FROM artifact_sentences WHERE artifactId = a.id AND deleted = 0) AS sentenceCount,
            s.id AS sentenceId,
            s.originalText AS sentenceOriginalText,
            s.translation AS sentenceTranslation,
            s.sortOrder AS sentenceSortOrder,
            s.createdAt AS sentenceCreatedAt
        FROM artifact_sentences s
        JOIN artifacts a ON a.id = s.artifactId
        WHERE s.deleted = 0
          AND a.deleted = 0
          AND (a.userId = ? OR a.isPublic = 1)
          AND (
            s.originalText LIKE ? ESCAPE '\\'
            OR EXISTS (
                SELECT 1 FROM sentence_words sw
                WHERE sw.sentenceId = s.id
                  AND sw.deleted = 0
                  AND (sw.wordSlug = ? OR sw.surfaceForm = ? OR sw.dictionaryForm = ?)
            )
          )
        ORDER BY a.updatedAt DESC, s.sortOrder ASC, s.createdAt ASC
        """, [.text(Self.currentUserId), .text(likePattern), .text(trimmed), .text(trimmed), .text(trimmed)])

        var order: [String] = []
        var artifactsById: [String: Artifact] = [:]
        var sentencesByArtifact: [String: [ArtifactSentence]] = [:]

        for row in rows {
            let artifactId = row["artifactId"] ?? ""
            guard !artifactId.isEmpty else { continue }
            if artifactsById[artifactId] == nil {
                order.append(artifactId)
                artifactsById[artifactId] = Artifact(
                    id: artifactId,
                    userId: row["artifactUserId"] ?? "",
                    title: row["artifactTitle"] ?? "",
                    description: row["artifactDescription"] ?? "",
                    language: LanguageCode(rawValue: row["artifactLanguage"] ?? "ja") ?? .ja,
                    type: row["artifactType"] ?? "other",
                    isPublic: row["artifactIsPublic"] == "1",
                    thumbnailPath: row["thumbnailPath"],
                    sentenceCount: Int(row["sentenceCount"] ?? "0") ?? 0,
                    createdAt: Self.date(fromMillis: row["artifactCreatedAt"]),
                    updatedAt: Self.date(fromMillis: row["artifactUpdatedAt"]),
                    dirty: row["artifactDirty"] == "1"
                )
            }

            let sentenceId = row["sentenceId"] ?? ""
            guard !sentenceId.isEmpty else { continue }
            sentencesByArtifact[artifactId, default: []].append(ArtifactSentence(
                id: sentenceId,
                artifactId: artifactId,
                originalText: row["sentenceOriginalText"] ?? "",
                translation: row["sentenceTranslation"] ?? "",
                sortOrder: Int(row["sentenceSortOrder"] ?? "0") ?? 0,
                createdAt: Self.date(fromMillis: row["sentenceCreatedAt"])
            ))
        }

        return order.compactMap { artifactId in
            guard let artifact = artifactsById[artifactId] else { return nil }
            return ArtifactMention(artifact: artifact, sentences: sentencesByArtifact[artifactId] ?? [])
        }
    }

    func listArtifactImages(artifactId: String) throws -> [ArtifactImage] {
        try queryRows("""
        SELECT id, artifactId, imagePath, sortOrder, createdAt
        FROM artifact_images
        WHERE artifactId = ? AND deleted = 0
        ORDER BY sortOrder, createdAt
        """, [.text(artifactId)]).map {
            ArtifactImage(
                id: $0["id"] ?? "",
                artifactId: $0["artifactId"] ?? "",
                imagePath: $0["imagePath"] ?? "",
                sortOrder: Int($0["sortOrder"] ?? "0") ?? 0,
                createdAt: Self.date(fromMillis: $0["createdAt"])
            )
        }
    }

    func addArtifactSentence(artifactId: String, original: String, translation: String) throws {
        let now = Self.nowMillis()
        let count = try scalarInt("SELECT count(*) FROM artifact_sentences WHERE artifactId = ?", [.text(artifactId)]) ?? 0
        let id = UUID().uuidString
        try run("""
        INSERT INTO artifact_sentences (id, artifactId, originalText, translation, sortOrder, createdAt, dirty, deleted)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0)
        """, [.text(id), .text(artifactId), .text(original), .text(translation), .int(count), .int(now)])
        try enqueue(
            entity: "artifactSentence",
            entityId: id,
            operation: "upsert",
            payload: Self.jsonPayload([
                "id": id,
                "artifactId": artifactId,
                "originalText": original,
                "translation": translation,
                "sortOrder": count,
                "createdAt": now
            ])
        )
    }

    func addArtifactImage(artifactId: String, imageData: Data) throws {
        let support = url.deletingLastPathComponent().appendingPathComponent("ArtifactImages", isDirectory: true)
        try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let id = UUID().uuidString
        let imageURL = support.appendingPathComponent("\(id).jpg")
        try imageData.write(to: imageURL, options: .atomic)
        let now = Self.nowMillis()
        let count = try scalarInt("SELECT count(*) FROM artifact_images WHERE artifactId = ?", [.text(artifactId)]) ?? 0
        try run("""
        INSERT INTO artifact_images (id, artifactId, imagePath, sortOrder, createdAt, dirty, deleted)
        VALUES (?, ?, ?, ?, ?, 1, 0)
        """, [.text(id), .text(artifactId), .text(imageURL.path), .int(count), .int(now)])
        let upload = Self.syncImageUpload(from: imageData)
        var payload: [String: Any] = [
            "id": id,
            "artifactId": artifactId,
            "imagePath": imageURL.path,
            "sortOrder": count,
            "createdAt": now
        ]
        if upload.data.count <= 5 * 1024 * 1024 {
            payload["imageDataBase64"] = upload.data.base64EncodedString()
            payload["contentType"] = upload.contentType
        } else {
            payload["imageTooLarge"] = true
        }
        try enqueue(
            entity: "artifactImage",
            entityId: id,
            operation: "upsert",
            payload: Self.jsonPayload(payload)
        )
    }

    func enqueue(entity: String, entityId: String, operation: String, payload: String) throws {
        try run("""
        INSERT INTO sync_queue (id, entity, entityId, operation, payload, attempts, lastError, createdAt)
        VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
        """, [.text(UUID().uuidString), .text(entity), .text(entityId), .text(operation), .text(payload), .int(Self.nowMillis())])
    }

    func listSyncTasks() throws -> [SyncTask] {
        try queryRows("""
        SELECT id, entity, entityId, operation, payload, attempts, lastError, createdAt
        FROM sync_queue
        ORDER BY createdAt
        """).map {
            SyncTask(
                id: $0["id"] ?? "",
                entity: $0["entity"] ?? "",
                entityId: $0["entityId"] ?? "",
                operation: $0["operation"] ?? "",
                payload: $0["payload"] ?? "",
                attempts: Int($0["attempts"] ?? "0") ?? 0,
                lastError: $0["lastError"] ?? "",
                createdAt: Self.date(fromMillis: $0["createdAt"])
            )
        }
    }

    func markSyncTaskComplete(id: String) throws {
        try run("DELETE FROM sync_queue WHERE id = ?", [.text(id)])
    }

    func markSyncTaskFailed(id: String, error: String) throws {
        try run("UPDATE sync_queue SET attempts = attempts + 1, lastError = ? WHERE id = ?", [.text(error), .text(id)])
    }

    func lastSyncAt() throws -> Int64 {
        try metadataInt("lastSyncAt") ?? 0
    }

    func setLastSyncAt(_ value: Int64) throws {
        try setMetadataInt("lastSyncAt", value)
    }

    func metadataInt(_ key: String) throws -> Int64? {
        guard let value = try scalarText("SELECT value FROM app_metadata WHERE key = ?", [.text(key)]) else { return nil }
        return Int64(value)
    }

    func setMetadataInt(_ key: String, _ value: Int64) throws {
        try run("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)", [.text(key), .text(String(value))])
    }

    func markLocalMutationSynced(task: SyncTask, serverTime: Int64) throws {
        let values: [SQLiteValue] = [.int(serverTime), .text(Self.currentUserId), .text(task.entityId), .text(task.entityId)]
        switch task.entity {
        case "note":
            try run(
                "UPDATE notes SET dirty = 0, syncedAt = ? WHERE userId = ? AND (character = ? OR id = ?)",
                values
            )
        case "studyCard", "studyReview":
            try run(
                "UPDATE study_cards SET dirty = 0, syncedAt = ? WHERE userId = ? AND (word = ? OR id = ?)",
                values
            )
        case "customWord":
            try run(
                "UPDATE custom_words SET dirty = 0, syncedAt = ? WHERE userId = ? AND (word = ? OR id = ?)",
                values
            )
        case "artifact":
            try run(
                "UPDATE artifacts SET dirty = 0, syncedAt = ? WHERE userId = ? AND id = ?",
                [.int(serverTime), .text(Self.currentUserId), .text(task.entityId)]
            )
        case "artifactSentence":
            try run(
                "UPDATE artifact_sentences SET dirty = 0, syncedAt = ? WHERE id = ?",
                [.int(serverTime), .text(task.entityId)]
            )
        case "artifactImage":
            try run(
                "UPDATE artifact_images SET dirty = 0, syncedAt = ? WHERE id = ?",
                [.int(serverTime), .text(task.entityId)]
            )
        default:
            break
        }
    }

    func applyPull(_ payload: CloudflarePullPayload) throws {
        try execute("BEGIN IMMEDIATE TRANSACTION")
        do {
            for note in payload.notes where !note.id.isEmpty && !note.character.isEmpty {
                try apply(remoteNote: note, syncedAt: payload.serverTime)
            }
            for card in payload.studyCards where !card.id.isEmpty && !card.word.isEmpty {
                try apply(remoteStudyCard: card, syncedAt: payload.serverTime)
            }
            for word in payload.customWords where !word.id.isEmpty && !word.word.isEmpty {
                try apply(remoteCustomWord: word, syncedAt: payload.serverTime)
            }
            for artifact in payload.artifacts where !artifact.id.isEmpty {
                try apply(remoteArtifact: artifact, syncedAt: payload.serverTime)
            }
            for image in payload.artifactImages where !image.id.isEmpty && !image.artifactId.isEmpty {
                try apply(remoteArtifactImage: image, syncedAt: payload.serverTime)
            }
            for sentence in payload.artifactSentences where !sentence.id.isEmpty && !sentence.artifactId.isEmpty {
                try apply(remoteArtifactSentence: sentence, syncedAt: payload.serverTime)
            }
            for tombstone in payload.tombstones where !tombstone.entity.isEmpty && !tombstone.entityId.isEmpty {
                try apply(remoteTombstone: tombstone)
            }
            try setLastSyncAt(payload.serverTime)
            try execute("COMMIT")
        } catch {
            try? execute("ROLLBACK")
            throw error
        }
    }

    private func apply(remoteNote note: RemoteNote, syncedAt: Int64) throws {
        try run("""
        INSERT INTO notes (id, userId, character, noteText, isAdmin, createdAt, updatedAt, dirty, deleted, syncedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(userId, character) DO UPDATE SET
            id = excluded.id,
            noteText = excluded.noteText,
            isAdmin = excluded.isAdmin,
            updatedAt = excluded.updatedAt,
            dirty = 0,
            deleted = 0,
            syncedAt = excluded.syncedAt
        WHERE notes.dirty = 0 OR notes.updatedAt <= excluded.updatedAt
        """, [
            .text(note.id),
            .text(Self.currentUserId),
            .text(note.character),
            .text(note.noteText),
            .int(note.isAdmin ? 1 : 0),
            .int(note.createdAt),
            .int(note.updatedAt),
            .int(syncedAt)
        ])
    }

    private func apply(remoteStudyCard card: RemoteStudyCard, syncedAt: Int64) throws {
        try run("""
        INSERT INTO study_cards (
            id, userId, word, language, easeFactor, interval, repetitions, nextReview, lastReviewed,
            createdAt, updatedAt, dirty, deleted, syncedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(userId, word) DO UPDATE SET
            id = excluded.id,
            language = excluded.language,
            easeFactor = excluded.easeFactor,
            interval = excluded.interval,
            repetitions = excluded.repetitions,
            nextReview = excluded.nextReview,
            lastReviewed = excluded.lastReviewed,
            updatedAt = excluded.updatedAt,
            dirty = 0,
            deleted = 0,
            syncedAt = excluded.syncedAt
        WHERE study_cards.dirty = 0 OR study_cards.updatedAt <= excluded.updatedAt
        """, [
            .text(card.id),
            .text(Self.currentUserId),
            .text(card.word),
            .text(card.language.isEmpty ? "ja" : card.language),
            .int(card.easeFactor),
            .int(card.interval),
            .int(card.repetitions),
            .int(card.nextReview),
            card.lastReviewed.map(SQLiteValue.int) ?? .null,
            .int(card.createdAt),
            .int(card.updatedAt),
            .int(syncedAt)
        ])
    }

    private func apply(remoteCustomWord word: RemoteCustomWord, syncedAt: Int64) throws {
        let definitions = Self.normalizedDefinitionsJSON(word.definitions)
        try run("""
        INSERT INTO custom_words (id, userId, word, language, reading, definitions, notes, createdAt, updatedAt, dirty, deleted, syncedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(word) DO UPDATE SET
            id = excluded.id,
            userId = excluded.userId,
            language = excluded.language,
            reading = excluded.reading,
            definitions = excluded.definitions,
            notes = excluded.notes,
            updatedAt = excluded.updatedAt,
            dirty = 0,
            deleted = 0,
            syncedAt = excluded.syncedAt
        WHERE custom_words.dirty = 0 OR custom_words.updatedAt <= excluded.updatedAt
        """, [
            .text(word.id),
            .text(Self.currentUserId),
            .text(word.word),
            .text(word.language.isEmpty ? "ja" : word.language),
            .text(word.reading),
            .text(definitions),
            .text(word.notes),
            .int(word.createdAt),
            .int(word.updatedAt),
            .int(syncedAt)
        ])
    }

    private func apply(remoteArtifact artifact: RemoteArtifact, syncedAt: Int64) throws {
        try run("""
        INSERT INTO artifacts (id, userId, title, description, language, type, isPublic, createdAt, updatedAt, dirty, deleted, syncedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            language = excluded.language,
            type = excluded.type,
            isPublic = excluded.isPublic,
            updatedAt = excluded.updatedAt,
            dirty = 0,
            deleted = 0,
            syncedAt = excluded.syncedAt
        WHERE artifacts.dirty = 0 OR artifacts.updatedAt <= excluded.updatedAt
        """, [
            .text(artifact.id),
            .text(Self.currentUserId),
            .text(artifact.title.isEmpty ? "Untitled" : artifact.title),
            .text(artifact.description),
            .text(artifact.language.isEmpty ? "ja" : artifact.language),
            .text(artifact.type.isEmpty ? "other" : artifact.type),
            .int(artifact.isPublic ? 1 : 0),
            .int(artifact.createdAt),
            .int(artifact.updatedAt),
            .int(syncedAt)
        ])
    }

    private func apply(remoteArtifactImage image: RemoteArtifactImage, syncedAt: Int64) throws {
        try run("""
        INSERT INTO artifact_images (id, artifactId, imagePath, sortOrder, createdAt, dirty, deleted, syncedAt)
        VALUES (?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
            artifactId = excluded.artifactId,
            imagePath = excluded.imagePath,
            sortOrder = excluded.sortOrder,
            dirty = 0,
            deleted = 0,
            syncedAt = excluded.syncedAt
        WHERE artifact_images.dirty = 0
        """, [
            .text(image.id),
            .text(image.artifactId),
            .text(image.imageUrl),
            .int(image.sortOrder),
            .int(image.createdAt),
            .int(syncedAt)
        ])
    }

    private func apply(remoteArtifactSentence sentence: RemoteArtifactSentence, syncedAt: Int64) throws {
        try run("""
        INSERT INTO artifact_sentences (id, artifactId, imageId, originalText, translation, sortOrder, createdAt, dirty, deleted, syncedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
            artifactId = excluded.artifactId,
            imageId = excluded.imageId,
            originalText = excluded.originalText,
            translation = excluded.translation,
            sortOrder = excluded.sortOrder,
            dirty = 0,
            deleted = 0,
            syncedAt = excluded.syncedAt
        WHERE artifact_sentences.dirty = 0
        """, [
            .text(sentence.id),
            .text(sentence.artifactId),
            sentence.imageId.isEmpty ? .null : .text(sentence.imageId),
            .text(sentence.originalText),
            .text(sentence.translation),
            .int(sentence.sortOrder),
            .int(sentence.createdAt),
            .int(syncedAt)
        ])
    }

    private func apply(remoteTombstone tombstone: RemoteTombstone) throws {
        switch tombstone.entity {
        case "note":
            try run("""
            UPDATE notes
            SET deleted = 1, dirty = 0, syncedAt = ?
            WHERE userId = ? AND (id = ? OR character = ?) AND (dirty = 0 OR updatedAt <= ?)
            """, [.int(tombstone.deletedAt), .text(Self.currentUserId), .text(tombstone.entityId), .text(tombstone.entityId), .int(tombstone.deletedAt)])
        case "studyCard", "studyReview":
            try run("""
            UPDATE study_cards
            SET deleted = 1, dirty = 0, syncedAt = ?
            WHERE userId = ? AND (id = ? OR word = ?) AND (dirty = 0 OR updatedAt <= ?)
            """, [.int(tombstone.deletedAt), .text(Self.currentUserId), .text(tombstone.entityId), .text(tombstone.entityId), .int(tombstone.deletedAt)])
        case "customWord":
            try run("""
            UPDATE custom_words
            SET deleted = 1, dirty = 0, syncedAt = ?
            WHERE userId = ? AND (id = ? OR word = ?) AND (dirty = 0 OR updatedAt <= ?)
            """, [.int(tombstone.deletedAt), .text(Self.currentUserId), .text(tombstone.entityId), .text(tombstone.entityId), .int(tombstone.deletedAt)])
        case "artifact":
            try run("""
            UPDATE artifacts
            SET deleted = 1, dirty = 0, syncedAt = ?
            WHERE userId = ? AND id = ? AND (dirty = 0 OR updatedAt <= ?)
            """, [.int(tombstone.deletedAt), .text(Self.currentUserId), .text(tombstone.entityId), .int(tombstone.deletedAt)])
        case "artifactSentence":
            try run("UPDATE artifact_sentences SET deleted = 1, dirty = 0, syncedAt = ? WHERE id = ? AND dirty = 0", [.int(tombstone.deletedAt), .text(tombstone.entityId)])
        case "artifactImage":
            try run("UPDATE artifact_images SET deleted = 1, dirty = 0, syncedAt = ? WHERE id = ? AND dirty = 0", [.int(tombstone.deletedAt), .text(tombstone.entityId)])
        default:
            break
        }
    }

    func execute(_ sql: String) throws {
        guard let handle else { throw LocalDatabaseError.missingDatabase }
        var errorMessage: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(handle, sql, nil, nil, &errorMessage) != SQLITE_OK {
            let message = errorMessage.map { String(cString: $0) } ?? "unknown"
            sqlite3_free(errorMessage)
            throw LocalDatabaseError.stepFailed(message)
        }
    }

    func addColumnIfMissing(table: String, column: String, definition: String) throws {
        let rows = try queryRows("PRAGMA table_info(\(table))")
        guard !rows.contains(where: { $0["name"] == column }) else { return }
        try execute("ALTER TABLE \(table) ADD COLUMN \(column) \(definition)")
    }

    func run(_ sql: String, _ values: [SQLiteValue] = []) throws {
        guard let handle else { throw LocalDatabaseError.missingDatabase }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw LocalDatabaseError.prepareFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(statement) }
        try bind(values, to: statement)
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw LocalDatabaseError.stepFailed(String(cString: sqlite3_errmsg(handle)))
        }
    }

    func queryRows(_ sql: String, _ values: [SQLiteValue] = []) throws -> [[String: String]] {
        guard let handle else { throw LocalDatabaseError.missingDatabase }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw LocalDatabaseError.prepareFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(statement) }
        try bind(values, to: statement)

        var output: [[String: String]] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            var row: [String: String] = [:]
            for index in 0..<sqlite3_column_count(statement) {
                let name = String(cString: sqlite3_column_name(statement, index))
                if let text = sqlite3_column_text(statement, index) {
                    row[name] = String(cString: text)
                } else {
                    row[name] = nil
                }
            }
            output.append(row)
        }
        return output
    }

    func scalarText(_ sql: String, _ values: [SQLiteValue] = []) throws -> String? {
        try queryRows(sql, values).first?.values.first
    }

    func scalarInt(_ sql: String, _ values: [SQLiteValue] = []) throws -> Int64? {
        guard let text = try scalarText(sql, values) else { return nil }
        return Int64(text)
    }

    private func bind(_ values: [SQLiteValue], to statement: OpaquePointer?) throws {
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (offset, value) in values.enumerated() {
            let index = Int32(offset + 1)
            switch value {
            case .text(let text):
                sqlite3_bind_text(statement, index, text, -1, transient)
            case .int(let int):
                sqlite3_bind_int64(statement, index, int)
            case .double(let double):
                sqlite3_bind_double(statement, index, double)
            case .blob(let data):
                _ = data.withUnsafeBytes { bytes in
                    sqlite3_bind_blob(statement, index, bytes.baseAddress, Int32(bytes.count), transient)
                }
            case .null:
                sqlite3_bind_null(statement, index)
            }
        }
    }

    static func nowMillis() -> Int64 {
        millis(from: Date())
    }

    static func millis(from date: Date) -> Int64 {
        Int64(date.timeIntervalSince1970 * 1000)
    }

    static func date(fromMillis millis: String?) -> Date {
        guard let millis, let value = Double(millis) else { return Date(timeIntervalSince1970: 0) }
        return Date(timeIntervalSince1970: value / 1000.0)
    }

    static func optionalDate(fromMillis millis: String?) -> Date? {
        guard let millis, let value = Double(millis), value > 0 else { return nil }
        return Date(timeIntervalSince1970: value / 1000.0)
    }

    static func escapedLikePattern(containing value: String) -> String {
        let escaped = value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "%", with: "\\%")
            .replacingOccurrences(of: "_", with: "\\_")
        return "%\(escaped)%"
    }

    static func noteImageMarker(id: String) -> String {
        "kiokun-note-image://\(id)"
    }

    static func noteImageId(from marker: String) -> String? {
        guard let url = URL(string: marker), url.scheme == "kiokun-note-image" else { return nil }
        if let host = url.host, !host.isEmpty {
            return host
        }
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return path.isEmpty ? nil : path
    }

    static func localNoteImageMarkers(in text: String) -> [String] {
        let pattern = #"kiokun-note-image://[A-Za-z0-9-]+"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let nsText = text as NSString
        let range = NSRange(location: 0, length: nsText.length)
        return regex.matches(in: text, range: range).map { nsText.substring(with: $0.range) }
    }

    static func encodeStringArray(_ values: [String]) -> String {
        let data = try? JSONSerialization.data(withJSONObject: values)
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
    }

    static func decodeStringArray(_ json: String?) -> [String] {
        guard
            let json,
            let data = json.data(using: .utf8),
            let values = try? JSONSerialization.jsonObject(with: data) as? [String]
        else { return [] }
        return values
    }

    static func normalizedDefinitionsJSON(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "[]" }
        if let data = trimmed.data(using: .utf8),
           (try? JSONSerialization.jsonObject(with: data) as? [String]) != nil {
            return trimmed
        }
        return encodeStringArray([trimmed])
    }

    static func jsonPayload(_ object: [String: Any]) -> String {
        let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    }

    static func syncImageUpload(from data: Data) -> (data: Data, contentType: String) {
        guard let image = UIImage(data: data) else {
            return (data, "image/jpeg")
        }

        let maxDimension: CGFloat = 2200
        let longestSide = max(image.size.width, image.size.height)
        let scale = longestSide > maxDimension ? maxDimension / longestSide : 1
        let targetSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let rendered = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }

        for quality in stride(from: 0.82, through: 0.42, by: -0.10) {
            if let jpeg = rendered.jpegData(compressionQuality: quality), jpeg.count <= 5 * 1024 * 1024 {
                return (jpeg, "image/jpeg")
            }
        }

        return (rendered.jpegData(compressionQuality: 0.35) ?? data, "image/jpeg")
    }

    static func jsonEscape(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
    }
}

@MainActor
final class SyncEngine {
    private let database: LocalDatabase
    private let client: CloudflareClient

    init(database: LocalDatabase, client: CloudflareClient = CloudflareClient()) {
        self.database = database
        self.client = client
    }

    func processQueue() async throws {
        let tasks = try database.listSyncTasks()
        if !tasks.isEmpty {
            let response: SyncPushResponse
            do {
                response = try await client.push(tasks: tasks)
            } catch {
                for task in tasks {
                    try database.markSyncTaskFailed(id: task.id, error: error.localizedDescription)
                }
                throw error
            }
            let results = Dictionary(uniqueKeysWithValues: response.applied.map { ($0.id, $0) })
            var firstFailure: Error?

            for task in tasks {
                guard let result = results[task.id] else {
                    let error = CloudflareClientError.invalidResponse("No result returned for \(task.entity).\(task.operation)")
                    try database.markSyncTaskFailed(id: task.id, error: error.localizedDescription)
                    firstFailure = firstFailure ?? error
                    continue
                }

                if result.status == "applied" {
                    try database.markLocalMutationSynced(task: task, serverTime: response.serverTime)
                    try database.markSyncTaskComplete(id: task.id)
                } else {
                    let error = CloudflareClientError.skipped(result.reason ?? "Server skipped \(task.entity).\(task.operation)")
                    try database.markSyncTaskFailed(id: task.id, error: error.localizedDescription)
                    firstFailure = firstFailure ?? error
                }
            }

            if let firstFailure {
                throw firstFailure
            }
        }

        let since = try database.lastSyncAt()
        let payload = try await client.pull(since: since)
        try database.applyPull(payload)
    }
}

enum CloudflareClientError: Error, LocalizedError {
    case missingBaseURL
    case unsupportedTask(String)
    case server(Int)
    case invalidResponse(String)
    case skipped(String)

    var errorDescription: String? {
        switch self {
        case .missingBaseURL: "Set a Cloudflare base URL in Settings before syncing."
        case .unsupportedTask(let task): "No sync endpoint is mapped for \(task)."
        case .server(let status):
            if status == 401 {
                "Cloudflare sync is unauthorized. Save a current Better Auth cookie in Settings."
            } else if status == 403 {
                "Cloudflare sync is forbidden for this account."
            } else {
                "Cloudflare returned HTTP \(status)."
            }
        case .invalidResponse(let message): message
        case .skipped(let message): message
        }
    }
}

enum SecureCredentialError: Error, LocalizedError {
    case unhandled(OSStatus)

    var errorDescription: String? {
        switch self {
        case .unhandled(let status): "Keychain returned status \(status)."
        }
    }
}

enum SecureCredentialStore {
    static let cloudflareSessionCookieAccount = "cloudflareSessionCookie"
    private static let service = "dev.kiokun.native"

    static func string(account: String) throws -> String {
        var query = baseQuery(account: account)
        query[kSecMatchLimit] = kSecMatchLimitOne
        query[kSecReturnData] = true

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return "" }
        guard status == errSecSuccess else { throw SecureCredentialError.unhandled(status) }
        guard let data = item as? Data, let value = String(data: data, encoding: .utf8) else { return "" }
        return value
    }

    static func setString(_ value: String, account: String) throws {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            try delete(account: account)
            return
        }

        let data = Data(trimmed.utf8)
        let query = baseQuery(account: account)
        let attributes: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess { return }
        if updateStatus != errSecItemNotFound {
            throw SecureCredentialError.unhandled(updateStatus)
        }

        var addQuery = query
        addQuery[kSecValueData] = data
        addQuery[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else { throw SecureCredentialError.unhandled(addStatus) }
    }

    static func delete(account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SecureCredentialError.unhandled(status)
        }
    }

    private static func baseQuery(account: String) -> [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
    }
}

struct CloudflareClient {
    var session: URLSession = .shared

    var baseURL: URL? {
        guard let raw = UserDefaults.standard.string(forKey: "cloudflareBaseURL")?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        return URL(string: raw)
    }

    func push(tasks: [SyncTask]) async throws -> SyncPushResponse {
        var request = try request(path: "/api/sync/push")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "clientId": "ios-native",
            "changes": tasks.map { task in
                [
                    "id": task.id,
                    "entity": task.entity,
                    "entityId": task.entityId,
                    "operation": task.operation,
                    "payload": decodedPayload(task.payload),
                    "createdAt": LocalDatabase.millis(from: task.createdAt)
                ] as [String: Any]
            }
        ] as [String: Any])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw CloudflareClientError.server((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(SyncPushResponse.self, from: data)
    }

    func pull(since: Int64) async throws -> CloudflarePullPayload {
        var components = URLComponents(url: try endpointURL(path: "/api/sync/pull"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "since", value: String(since))]
        guard let url = components?.url else {
            throw CloudflareClientError.invalidResponse("Could not build pull URL")
        }

        var request = try request(url: url)
        request.httpMethod = "GET"

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw CloudflareClientError.server((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(CloudflarePullPayload.self, from: data)
    }

    func entryNotes(character: String) async throws -> [RemoteEntryNote] {
        let encoded = character.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? character
        let url = try endpointURL(path: "/api/notes/\(encoded)")
        var request = try request(url: url)
        request.httpMethod = "GET"

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw CloudflareClientError.server((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode([RemoteEntryNote].self, from: data)
    }

    private func request(path: String) throws -> URLRequest {
        try request(url: endpointURL(path: path))
    }

    private func request(url: URL) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let cookie = (try? SecureCredentialStore.string(account: SecureCredentialStore.cloudflareSessionCookieAccount)) ?? ""
        if !cookie.isEmpty {
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        }
        return request
    }

    private func endpointURL(path: String) throws -> URL {
        guard let baseURL else { throw CloudflareClientError.missingBaseURL }
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw CloudflareClientError.invalidResponse("Could not build Cloudflare URL")
        }
        return url
    }

    private func decodedPayload(_ raw: String) -> Any {
        guard
            let data = raw.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data)
        else { return [:] }
        return object
    }
}

enum NativeAuthBridgeError: Error, LocalizedError, Equatable {
    case missingBaseURL
    case invalidBaseURL
    case missingAuthorizationURL
    case callbackStateMismatch
    case callbackMissingCookie
    case callbackError(String)
    case sessionStartFailed

    var errorDescription: String? {
        switch self {
        case .missingBaseURL:
            "Set a Cloudflare base URL before signing in."
        case .invalidBaseURL:
            "Cloudflare base URL is invalid."
        case .missingAuthorizationURL:
            "Cloudflare did not return a Google sign-in URL."
        case .callbackStateMismatch:
            "Sign-in callback state did not match. Try signing in again."
        case .callbackMissingCookie:
            "Sign-in finished without a Better Auth cookie."
        case .callbackError(let message):
            "Sign-in failed: \(message)"
        case .sessionStartFailed:
            "Could not open the system sign-in session."
        }
    }
}

struct NativeAuthCallback: Equatable {
    var state: String
    var cookie: String
}

private struct NativeAuthStartResponse: Decodable {
    var url: String?
}

enum NativeAuthBridge {
    static let callbackScheme = "kiokun"
    static let callbackHost = "auth"

    static func completionPath(state: String) -> String {
        "/api/mobile-auth/complete?state=\(percentEncode(state))"
    }

    static func socialSignInRequest(baseURL rawBaseURL: String, state: String) throws -> URLRequest {
        let trimmed = rawBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw NativeAuthBridgeError.missingBaseURL }
        guard let baseURL = URL(string: trimmed) else { throw NativeAuthBridgeError.invalidBaseURL }
        guard let endpoint = URL(string: "/api/auth/sign-in/social", relativeTo: baseURL)?.absoluteURL else {
            throw NativeAuthBridgeError.invalidBaseURL
        }

        let callbackURL = completionPath(state: state)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "provider": "google",
            "callbackURL": callbackURL,
            "errorCallbackURL": callbackURL,
            "newUserCallbackURL": callbackURL,
            "disableRedirect": true
        ] as [String: Any])
        return request
    }

    static func authorizationURL(baseURL: String, state: String) async throws -> URL {
        let request = try socialSignInRequest(baseURL: baseURL, state: state)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw CloudflareClientError.server((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        let payload = try JSONDecoder().decode(NativeAuthStartResponse.self, from: data)
        guard let rawURL = payload.url, let url = URL(string: rawURL) else {
            throw NativeAuthBridgeError.missingAuthorizationURL
        }
        return url
    }

    static func parseCallbackURL(_ url: URL, expectedState: String) throws -> NativeAuthCallback {
        guard url.scheme == callbackScheme, url.host == callbackHost else {
            throw NativeAuthBridgeError.callbackError("Unexpected callback URL")
        }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []
        let error = queryItems.first(where: { $0.name == "error" })?.value
        let errorDescription = queryItems.first(where: { $0.name == "error_description" })?.value
        if let error, !error.isEmpty {
            throw NativeAuthBridgeError.callbackError(errorDescription?.isEmpty == false ? errorDescription! : error)
        }
        let state = queryItems.first(where: { $0.name == "state" })?.value ?? ""
        guard state == expectedState else { throw NativeAuthBridgeError.callbackStateMismatch }

        let fragmentItems = fragmentQueryItems(url.fragment)
        let rawCookie = fragmentItems.first(where: { $0.name == "cookie" })?.value
            ?? queryItems.first(where: { $0.name == "cookie" })?.value
            ?? ""
        let cookie = rawCookie.removingPercentEncoding ?? rawCookie
        guard !cookie.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NativeAuthBridgeError.callbackMissingCookie
        }
        return NativeAuthCallback(state: state, cookie: cookie)
    }

    private static func fragmentQueryItems(_ fragment: String?) -> [URLQueryItem] {
        guard let fragment, !fragment.isEmpty else { return [] }
        var components = URLComponents()
        components.query = fragment
        return components.queryItems ?? []
    }

    private static func percentEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }
}

@MainActor
final class NativeAuthSessionCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func authenticate(authorizationURL: URL, expectedState: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: authorizationURL, callbackURLScheme: NativeAuthBridge.callbackScheme) { callbackURL, error in
                self.session = nil
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: NativeAuthBridgeError.callbackMissingCookie)
                    return
                }
                do {
                    let callback = try NativeAuthBridge.parseCallbackURL(callbackURL, expectedState: expectedState)
                    continuation.resume(returning: callback.cookie)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                continuation.resume(throwing: NativeAuthBridgeError.sessionStartFailed)
            }
        }
    }

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if Thread.isMainThread {
            return MainActor.assumeIsolated {
                Self.currentPresentationAnchor()
            }
        }
        return DispatchQueue.main.sync {
            MainActor.assumeIsolated {
                Self.currentPresentationAnchor()
            }
        }
    }

    @MainActor
    private static func currentPresentationAnchor() -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

enum HandwritingRecognitionError: Error, LocalizedError {
    case missingBaseURL
    case invalidBaseURL
    case invalidResponse(String)
    case server(Int)

    var errorDescription: String? {
        switch self {
        case .missingBaseURL:
            "Set Cloudflare base URL in Settings"
        case .invalidBaseURL:
            "Cloudflare base URL is invalid"
        case .invalidResponse(let message):
            message
        case .server(let status):
            "Handwriting recognition failed with HTTP \(status)"
        }
    }
}

struct HandwritingRecognitionClient {
    static var mockCandidatesFromEnvironment: [String]? {
        guard let raw = ProcessInfo.processInfo.environment["KIOKUN_HANDWRITING_MOCK_CANDIDATES"], !raw.isEmpty else {
            return nil
        }
        let candidates = raw
            .split(separator: ",")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return candidates.isEmpty ? nil : candidates
    }

    static func requestBody(strokes: [HandwritingStroke], language: HandwritingRecognitionLanguage) throws -> Data {
        try JSONEncoder().encode(HandwritingRecognitionRequest(strokes: strokes, language: language.rawValue))
    }

    static func recognitionURL(baseURL rawBaseURL: String) throws -> URL {
        let trimmed = rawBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw HandwritingRecognitionError.missingBaseURL }
        guard let baseURL = URL(string: trimmed), baseURL.scheme != nil, baseURL.host != nil else {
            throw HandwritingRecognitionError.invalidBaseURL
        }
        guard let url = URL(string: "/api/handwriting", relativeTo: baseURL)?.absoluteURL else {
            throw HandwritingRecognitionError.invalidResponse("Could not build handwriting recognition URL")
        }
        return url
    }

    static func parseCandidates(from data: Data) throws -> [String] {
        if let response = try? JSONDecoder().decode(HandwritingRecognitionResponse.self, from: data) {
            return response.candidates
        }

        let object = try JSONSerialization.jsonObject(with: data)
        if let dictionary = object as? [String: Any], let candidates = dictionary["candidates"] as? [String] {
            return candidates
        }

        if
            let response = object as? [Any],
            let status = response.first as? String,
            status == "SUCCESS",
            response.count > 1,
            let groups = response[1] as? [[Any]],
            let firstGroup = groups.first,
            firstGroup.count > 1,
            let candidates = firstGroup[1] as? [String]
        {
            return candidates
        }

        throw HandwritingRecognitionError.invalidResponse("Could not parse handwriting candidates")
    }

    func recognize(strokes: [HandwritingStroke], language: HandwritingRecognitionLanguage, baseURL: String) async throws -> [String] {
        if let mockCandidates = Self.mockCandidatesFromEnvironment {
            return mockCandidates
        }

        var request = URLRequest(url: try Self.recognitionURL(baseURL: baseURL))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try Self.requestBody(strokes: strokes, language: language)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw HandwritingRecognitionError.server((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try Self.parseCandidates(from: data)
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @AppStorage("appColorScheme") private var appColorScheme = "system"

    var body: some View {
        Group {
            if model.db == nil {
                VStack(spacing: 12) {
                    ProgressView()
                    Text(model.statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("root.loading")
            } else {
                tabContent
            }
        }
        .preferredColorScheme(preferredScheme)
    }

    private var tabContent: some View {
        TabView {
            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }

            StudyView()
                .tabItem { Label("Study", systemImage: "rectangle.stack.badge.person.crop") }

            GameTabView()
                .tabItem { Label("Game", systemImage: "gamecontroller.fill") }

            ListsView()
                .tabItem { Label("Lists", systemImage: "list.bullet.rectangle") }

            MoreView()
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .overlay(alignment: .bottom) {
            if model.shouldShowStatusToast {
                StatusToast(message: model.statusMessage)
                    .padding(.bottom, 52)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
        }
        .accessibilityIdentifier("root.tabview")
    }

    private var preferredScheme: ColorScheme? {
        switch appColorScheme {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }
}

struct GameTabView: View {
    var body: some View {
        NavigationStack {
            GameView()
                .navigationDestination(for: String.self) { word in
                    DictionaryDetailView(word: word)
                }
        }
    }
}

struct MoreView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        LibraryContentView()
                    } label: {
                        LibraryFeatureRow(title: "Library", subtitle: "Sentence reader, reels, frequency, phonetics, and offline packs.", icon: "books.vertical")
                    }
                    .accessibilityIdentifier("more.library")

                    NavigationLink {
                        ArtifactsContentView()
                    } label: {
                        LibraryFeatureRow(title: "Artifacts", subtitle: "Photos, signs, packaging, and sentence collections.", icon: "camera.viewfinder")
                    }
                    .accessibilityIdentifier("more.artifacts")
                } header: {
                    Text("Explore")
                }

                Section {
                    NavigationLink {
                        SettingsContentView()
                    } label: {
                        LibraryFeatureRow(title: "Settings", subtitle: "\(model.syncTasks.count) queued sync tasks · \(model.staticAssets.count) offline assets", icon: "gearshape")
                    }
                    .accessibilityIdentifier("more.settings")
                }
            }
            .navigationTitle("More")
        }
    }
}

struct StatusToast: View {
    var message: String

    var body: some View {
        Text(message)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.regularMaterial, in: Capsule())
            .padding(.horizontal)
    }
}

@MainActor
final class NativeSpeechService {
    static let shared = NativeSpeechService()
    private let synthesizer = AVSpeechSynthesizer()

    private init() {}

    func speak(_ text: String, language: LanguageCode) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        let utterance = AVSpeechUtterance(string: trimmed)
        utterance.voice = AVSpeechSynthesisVoice(language: language.speechLocale)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
        utterance.pitchMultiplier = 1.0
        synthesizer.speak(utterance)
    }
}

struct NativeSpeechButton: View {
    var text: String
    var language: LanguageCode
    var label: String? = nil

    var body: some View {
        Button {
            NativeSpeechService.shared.speak(text, language: language)
        } label: {
            if let label {
                Label(label, systemImage: "speaker.wave.2")
            } else {
                Image(systemName: "speaker.wave.2")
            }
        }
        .buttonStyle(.borderless)
        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        .accessibilityLabel(label ?? "Listen")
        .accessibilityIdentifier("speech.\(language.rawValue).\(text)")
    }
}

struct SearchView: View {
    @EnvironmentObject private var model: AppModel
    @State private var query = ""
    @State private var showingHandwriting = false
    @State private var path = NavigationPath()

    private var sentenceRoute: SentenceReaderRoute? {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard NativeSentenceHeuristics.isSentenceLike(trimmed) else { return nil }
        return SentenceReaderRoute(
            sentence: trimmed,
            translation: "",
            language: NativeSentenceHeuristics.inferredLanguage(for: trimmed, selected: model.selectedLanguage)
        )
    }

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    HomeHeroSection(
                        onRandomCharacter: { path.append(HomeContent.characterComparisons.randomElement()?.traditional ?? "語") },
                        onHandwriting: { showingHandwriting = true },
                        onSearchTerm: searchTerm
                    )

                    Section {
                        HomeDailyPicksView(day: Date()) { word in
                            path.append(word)
                        }
                    }

                    Section("Characters") {
                        HomeCharacterComparisonGrid(items: HomeContent.characterComparisons) { word in
                            path.append(word)
                        }
                    }

                    Section("Words") {
                        HomeSharedWordsView(items: HomeContent.sharedWords) { word in
                            path.append(word)
                        }
                    }

                    Section {
                        HomeSearchChipsView(terms: HomeContent.searchSuggestions, onSelect: searchTerm)
                    } header: {
                        Text("Search by English")
                    } footer: {
                        Text("Find characters and words by meaning.")
                    }

                    HomeFeaturedReelsSection()

                    Section("Try a Sentence") {
                        HomeSentenceSamplesView(samples: HomeContent.sampleSentences)
                    }

                    Section {
                        HomeConjugatedFormsView(items: HomeContent.conjugatedForms, onSelect: searchTerm)
                    } header: {
                        Text("Conjugated Forms")
                    } footer: {
                        Text("Search resolves dictionary forms for Japanese and Korean.")
                    }

                    Section("Homophones") {
                        HomeHomophonesView(items: HomeContent.homophones)
                    }

                    Section("Browse by Category") {
                        HomeCategoryChipsView(items: HomeContent.categories, onSelect: searchTerm)
                    }

                    Section("Explore") {
                        HomeExploreLinksView()
                    }
                } else {
                    Picker("Language", selection: $model.selectedLanguage) {
                        ForEach(LanguageFilter.allCases) { filter in
                            Text(filter.title).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)

                    if let sentenceRoute {
                        SearchSentenceBreakdownSection(route: sentenceRoute)
                    }

                    Section("Results") {
                        ForEach(model.searchResults) { result in
                            NavigationLink(value: result.word) {
                                SearchResultRow(result: result)
                            }
                            .accessibilityIdentifier("search.result.\(result.word)")
                        }
                    }
                }
            }
            .accessibilityIdentifier("search.list")
            .navigationTitle("Kiokun")
            .navigationDestination(for: String.self) { word in
                DictionaryDetailView(word: word)
            }
            .navigationDestination(for: SentenceReaderRoute.self) { route in
                SentenceReaderView(
                    initialSentence: route.sentence,
                    initialTranslation: route.translation,
                    initialLanguage: route.language
                )
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search characters, words, or sentences...")
            .onChange(of: query) { _, newValue in model.search(newValue) }
            .onChange(of: model.selectedLanguage) { _, _ in model.search(query) }
            .task { model.search(query) }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        showingHandwriting = true
                    } label: {
                        Image(systemName: "pencil.tip")
                    }
                    .accessibilityLabel("Handwriting")
                    .accessibilityIdentifier("handwriting.open")

                    NavigationLink {
                        CustomWordEditor()
                    } label: {
                        Image(systemName: "plus.circle")
                    }
                    .accessibilityLabel("Add custom word")
                    .accessibilityIdentifier("customWord.add")
                }
            }
            .sheet(isPresented: $showingHandwriting) {
                HandwritingInputSheet(initialLanguage: HandwritingRecognitionLanguage(filter: model.selectedLanguage)) { candidate in
                    query = candidate
                    model.search(candidate)
                    showingHandwriting = false
                }
            }
        }
    }

    private func searchTerm(_ term: String) {
        query = term
        model.search(term)
    }
}

private struct HomeWordPick: Hashable {
    var word: String
    var gloss: String
}

private struct HomeCharacterComparison: Hashable {
    var traditional: String
    var simplified: String
    var japanese: String
    var meaning: String
}

private struct HomeSharedWord: Hashable {
    var traditional: String
    var simplified: String?
    var label: String
}

private struct HomeSentenceSample: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(text)" }
    var language: LanguageCode
    var text: String
    var translation: String
}

struct SentenceReaderRoute: Hashable {
    var sentence: String
    var translation: String
    var language: LanguageCode
}

enum NativeSentenceHeuristics {
    static func isSentenceLike(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 4, containsCJK(trimmed) else { return false }
        if containsWhitespaceOrSentencePunctuation(trimmed) { return true }
        if containsHangul(trimmed), trimmed.count >= 6 { return true }
        if containsKana(trimmed), trimmed.count >= 6 { return true }
        return hanCharacterCount(trimmed) >= 5
    }

    static func inferredLanguage(for text: String, selected: LanguageFilter) -> LanguageCode {
        if let code = selected.code {
            return code
        }
        if containsHangul(text) {
            return .ko
        }
        if containsKana(text) {
            return .ja
        }
        return .zh
    }

    private static func containsWhitespaceOrSentencePunctuation(_ text: String) -> Bool {
        text.unicodeScalars.contains { scalar in
            CharacterSet.whitespacesAndNewlines.contains(scalar) ||
            "。！？!?，、,.;；：:".unicodeScalars.contains(scalar)
        }
    }

    private static func containsCJK(_ text: String) -> Bool {
        text.unicodeScalars.contains { scalar in
            isHan(scalar) || isKana(scalar) || isHangul(scalar)
        }
    }

    private static func containsKana(_ text: String) -> Bool {
        text.unicodeScalars.contains(where: isKana)
    }

    private static func containsHangul(_ text: String) -> Bool {
        text.unicodeScalars.contains(where: isHangul)
    }

    private static func hanCharacterCount(_ text: String) -> Int {
        text.unicodeScalars.reduce(0) { count, scalar in
            count + (isHan(scalar) ? 1 : 0)
        }
    }

    private static func isHan(_ scalar: UnicodeScalar) -> Bool {
        (0x3400...0x4DBF).contains(Int(scalar.value)) ||
        (0x4E00...0x9FFF).contains(Int(scalar.value)) ||
        (0xF900...0xFAFF).contains(Int(scalar.value))
    }

    private static func isKana(_ scalar: UnicodeScalar) -> Bool {
        (0x3040...0x30FF).contains(Int(scalar.value))
    }

    private static func isHangul(_ scalar: UnicodeScalar) -> Bool {
        (0x1100...0x11FF).contains(Int(scalar.value)) ||
        (0xAC00...0xD7AF).contains(Int(scalar.value))
    }
}

private struct HomeConjugatedForm: Identifiable, Hashable {
    var id: String { word }
    var language: LanguageCode
    var word: String
    var base: String
    var label: String
}

private struct HomeHomophone: Identifiable, Hashable {
    var id: String { "\(language.rawValue)-\(reading)" }
    var language: LanguageCode
    var reading: String
    var words: String
}

private struct HomeCategoryHighlight: Identifiable, Hashable {
    var id: String { name }
    var name: String
    var query: String
    var systemImage: String
}

private enum HomeContent {
    static let wordPool: [HomeWordPick] = [
        HomeWordPick(word: "友達", gloss: "friend"),
        HomeWordPick(word: "勉強", gloss: "study"),
        HomeWordPick(word: "天気", gloss: "weather"),
        HomeWordPick(word: "家族", gloss: "family"),
        HomeWordPick(word: "約束", gloss: "promise"),
        HomeWordPick(word: "冒険", gloss: "adventure"),
        HomeWordPick(word: "記憶", gloss: "memory"),
        HomeWordPick(word: "幸福", gloss: "happiness")
    ]

    static let characterComparisons: [HomeCharacterComparison] = [
        HomeCharacterComparison(traditional: "龍", simplified: "龙", japanese: "竜", meaning: "dragon"),
        HomeCharacterComparison(traditional: "圖", simplified: "图", japanese: "図", meaning: "map"),
        HomeCharacterComparison(traditional: "鐵", simplified: "铁", japanese: "鉄", meaning: "iron"),
        HomeCharacterComparison(traditional: "齒", simplified: "齿", japanese: "歯", meaning: "tooth"),
        HomeCharacterComparison(traditional: "廣", simplified: "广", japanese: "広", meaning: "wide"),
        HomeCharacterComparison(traditional: "實", simplified: "实", japanese: "実", meaning: "real"),
        HomeCharacterComparison(traditional: "戰", simplified: "战", japanese: "戦", meaning: "war"),
        HomeCharacterComparison(traditional: "樂", simplified: "乐", japanese: "楽", meaning: "music / joy")
    ]

    static let sharedWords: [HomeSharedWord] = [
        HomeSharedWord(traditional: "學校", simplified: "学校", label: "School"),
        HomeSharedWord(traditional: "音樂", simplified: "音乐", label: "Music"),
        HomeSharedWord(traditional: "時間", simplified: "时间", label: "Time"),
        HomeSharedWord(traditional: "自然", simplified: nil, label: "Nature"),
        HomeSharedWord(traditional: "人生", simplified: nil, label: "Life"),
        HomeSharedWord(traditional: "世界", simplified: nil, label: "World"),
        HomeSharedWord(traditional: "歷史", simplified: "历史", label: "History"),
        HomeSharedWord(traditional: "文化", simplified: nil, label: "Culture"),
        HomeSharedWord(traditional: "社會", simplified: "社会", label: "Society"),
        HomeSharedWord(traditional: "科學", simplified: "科学", label: "Science")
    ]

    static let searchSuggestions = ["beautiful", "water", "love", "eat", "house", "big", "happy", "sun", "mountain", "friend", "time"]

    static let sampleSentences: [HomeSentenceSample] = [
        HomeSentenceSample(language: .ja, text: "私は日本語を勉強しています", translation: "I am studying Japanese"),
        HomeSentenceSample(language: .ja, text: "今日は天気がいいですね", translation: "The weather is nice today"),
        HomeSentenceSample(language: .zh, text: "我今天很开心", translation: "I am very happy today"),
        HomeSentenceSample(language: .zh, text: "明天下雨吗", translation: "Will it rain tomorrow?"),
        HomeSentenceSample(language: .ko, text: "저는 한국어를 공부합니다", translation: "I study Korean"),
        HomeSentenceSample(language: .ko, text: "오늘 날씨가 좋습니다", translation: "The weather is nice today")
    ]

    static let conjugatedForms: [HomeConjugatedForm] = [
        HomeConjugatedForm(language: .ja, word: "食べている", base: "食べる", label: "eating"),
        HomeConjugatedForm(language: .ja, word: "行きました", base: "行く", label: "went"),
        HomeConjugatedForm(language: .ja, word: "美しかった", base: "美しい", label: "was beautiful"),
        HomeConjugatedForm(language: .ko, word: "먹고있어요", base: "먹다", label: "eating"),
        HomeConjugatedForm(language: .ko, word: "갔습니다", base: "가다", label: "went"),
        HomeConjugatedForm(language: .ko, word: "보고싶어요", base: "보다", label: "want to see")
    ]

    static let homophones: [HomeHomophone] = [
        HomeHomophone(language: .ja, reading: "こうしょう", words: "交渉 · 高尚 · 公称 · 考証"),
        HomeHomophone(language: .ja, reading: "きかん", words: "期間 · 機関 · 気管 · 帰還"),
        HomeHomophone(language: .zh, reading: "shì", words: "是 · 事 · 市 · 式 · 世"),
        HomeHomophone(language: .zh, reading: "yī", words: "一 · 衣 · 医 · 依 · 伊"),
        HomeHomophone(language: .ko, reading: "수", words: "水 · 手 · 数 · 首 · 守"),
        HomeHomophone(language: .ko, reading: "사", words: "四 · 死 · 社 · 士 · 事")
    ]

    static let categories: [HomeCategoryHighlight] = [
        HomeCategoryHighlight(name: "Animals", query: "animal", systemImage: "pawprint"),
        HomeCategoryHighlight(name: "Body", query: "body", systemImage: "figure.arms.open"),
        HomeCategoryHighlight(name: "Nature", query: "nature", systemImage: "leaf"),
        HomeCategoryHighlight(name: "Numbers", query: "number", systemImage: "number"),
        HomeCategoryHighlight(name: "Colors", query: "color", systemImage: "paintpalette"),
        HomeCategoryHighlight(name: "Food", query: "food", systemImage: "fork.knife"),
        HomeCategoryHighlight(name: "Weather", query: "weather", systemImage: "cloud.sun"),
        HomeCategoryHighlight(name: "Family", query: "family", systemImage: "person.3")
    ]

    static func dailyCharacter(day: Date) -> HomeCharacterComparison {
        let index = dayIndex(day) % characterComparisons.count
        return characterComparisons[index]
    }

    static func dailyWord(day: Date) -> HomeWordPick {
        let index = dayIndex(day, salt: "word") % wordPool.count
        return wordPool[index]
    }

    private static func dayIndex(_ day: Date, salt: String = "") -> Int {
        let components = Calendar.current.dateComponents([.year, .month, .day], from: day)
        let seed = "\(components.year ?? 0)-\(components.month ?? 0)-\(components.day ?? 0)-\(salt)"
        return abs(seed.unicodeScalars.reduce(0) { (($0 << 5) &- $0) &+ Int($1.value) })
    }
}

private struct HomeHeroSection: View {
    var onRandomCharacter: () -> Void
    var onHandwriting: () -> Void
    var onSearchTerm: (String) -> Void

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 12) {
                Text("The shared vocabulary of Chinese, Japanese & Korean")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 10) {
                    Button(action: onRandomCharacter) {
                        Label("Random", systemImage: "shuffle")
                    }
                    .buttonStyle(.bordered)

                    Button(action: onHandwriting) {
                        Label("Draw", systemImage: "pencil.tip")
                    }
                    .buttonStyle(.bordered)

                    Button {
                        onSearchTerm("memory")
                    } label: {
                        Label("Search", systemImage: "magnifyingglass")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .labelStyle(.iconOnly)
            }
            .padding(.vertical, 10)
        }
    }
}

private struct HomeDailyPicksView: View {
    var day: Date
    var onSelect: (String) -> Void

    var body: some View {
        let character = HomeContent.dailyCharacter(day: day)
        let word = HomeContent.dailyWord(day: day)
        HStack(spacing: 10) {
            HomeDailyPickRow(label: "Character of the Day", main: character.traditional, gloss: character.meaning) {
                onSelect(character.traditional)
            }
            HomeDailyPickRow(label: "Word of the Day", main: word.word, gloss: word.gloss) {
                onSelect(word.word)
            }
        }
    }
}

private struct HomeDailyPickRow: View {
    var label: String
    var main: String
    var gloss: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    Text(gloss)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                }
                Spacer()
                Text(main)
                    .font(.system(size: main.count > 1 ? 30 : 42, weight: .semibold, design: .serif))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .topLeading)
            .padding(10)
            .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

private struct HomeCharacterComparisonGrid: View {
    var items: [HomeCharacterComparison]
    var onSelect: (String) -> Void
    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 10)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
            ForEach(items, id: \.traditional) { item in
                Button {
                    onSelect(item.traditional)
                } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 4) {
                            Text(item.traditional)
                            Text("/")
                                .foregroundStyle(.tertiary)
                            Text(item.simplified)
                            Text("/")
                                .foregroundStyle(.tertiary)
                            Text(item.japanese)
                        }
                        .font(.title2.weight(.semibold))
                        Text(item.meaning)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct HomeSharedWordsView: View {
    var items: [HomeSharedWord]
    var onSelect: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(items, id: \.traditional) { item in
                    Button {
                        onSelect(item.traditional)
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(item.traditional)
                                    .font(.headline.weight(.semibold))
                                if let simplified = item.simplified, simplified != item.traditional {
                                    Text(simplified)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Text(item.label)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }
}

private struct HomeSearchChipsView: View {
    var terms: [String]
    var onSelect: (String) -> Void

    var body: some View {
        FlowLayout(items: terms) { term in
            Button(term) {
                onSelect(term)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
    }
}

private struct HomeFeaturedReelsSection: View {
    @EnvironmentObject private var model: AppModel
    @State private var videos: [ReelVideo] = []

    var body: some View {
        Group {
            if !videos.isEmpty {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 10) {
                            ForEach(videos) { video in
                                NavigationLink {
                                    ReelDetailView(videoId: video.videoId, language: video.language)
                                } label: {
                                    HomeReelCard(video: video)
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("home.reel.\(video.videoId)")
                            }
                        }
                        .padding(.vertical, 2)
                    }
                } header: {
                    Text("Learn from Videos")
                } footer: {
                    Text("Watch real content with interactive transcripts.")
                }
            }
        }
        .task(id: model.db != nil) {
            load()
        }
    }

    private func load() {
        guard let db = model.db else {
            videos = []
            return
        }
        do {
            let japanese = Array(try db.reelVideos(language: .ja).prefix(4))
            let chinese = Array(try db.reelVideos(language: .zh).prefix(4))
            videos = Array(interleave(japanese, chinese).prefix(8))
        } catch {
            videos = []
        }
    }

    private func interleave(_ lhs: [ReelVideo], _ rhs: [ReelVideo]) -> [ReelVideo] {
        let limit = max(lhs.count, rhs.count)
        var output: [ReelVideo] = []
        for index in 0..<limit {
            if lhs.indices.contains(index) { output.append(lhs[index]) }
            if rhs.indices.contains(index) { output.append(rhs[index]) }
        }
        return output
    }
}

private struct HomeReelCard: View {
    var video: ReelVideo

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topTrailing) {
                ReelThumbnail(urlString: video.thumbnail)
                    .frame(width: 92, height: 164)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                Text(video.language == .zh ? "中文" : "日本語")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(.black.opacity(0.58), in: Capsule())
                    .padding(6)
            }

            Text(video.sampleWord.isEmpty ? video.title : video.sampleWord)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .frame(width: 92, alignment: .center)
        }
        .accessibilityLabel(video.sampleWord.isEmpty ? video.title : video.sampleWord)
    }
}

private struct HomeSentenceSamplesView: View {
    var samples: [HomeSentenceSample]

    var body: some View {
        ForEach(samples) { sample in
            NavigationLink {
                SentenceReaderView(initialSentence: sample.text, initialTranslation: sample.translation, initialLanguage: sample.language)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(sample.text)
                        .font(.body.weight(.medium))
                    Text(sample.translation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct HomeConjugatedFormsView: View {
    var items: [HomeConjugatedForm]
    var onSelect: (String) -> Void

    var body: some View {
        ForEach(items) { item in
            Button {
                onSelect(item.word)
            } label: {
                HStack(spacing: 8) {
                    Text(item.word)
                        .font(.body.weight(.medium))
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(item.base)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(item.label)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)
        }
    }
}

private struct HomeHomophonesView: View {
    var items: [HomeHomophone]

    var body: some View {
        ForEach(items) { item in
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                MetadataChip(text: item.language.title)
                Text(item.reading)
                    .font(.subheadline.monospaced().weight(.semibold))
                Text(item.words)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

private struct HomeCategoryChipsView: View {
    var items: [HomeCategoryHighlight]
    var onSelect: (String) -> Void

    var body: some View {
        FlowLayout(items: items) { item in
            Button {
                onSelect(item.query)
            } label: {
                Label(item.name, systemImage: item.systemImage)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
    }
}

private struct HomeExploreLinksView: View {
    var body: some View {
        Group {
            NavigationLink {
                SentenceReaderView()
            } label: {
                LibraryFeatureRow(title: "Sentence Reader", subtitle: "Paste a sentence and tap words for offline lookup.", icon: "text.viewfinder")
            }

            NavigationLink {
                ReelsView()
            } label: {
                LibraryFeatureRow(title: "Reels", subtitle: "Real Japanese and Chinese clips with transcript lookup.", icon: "play.rectangle")
            }

            NavigationLink {
                ArtifactsContentView()
            } label: {
                LibraryFeatureRow(title: "Artifacts", subtitle: "Photos, signs, packaging, and sentence collections.", icon: "camera.viewfinder")
            }

            NavigationLink {
                FrequencyView()
            } label: {
                LibraryFeatureRow(title: "Frequency Lists", subtitle: "Common Japanese, Chinese, and Korean words.", icon: "chart.bar")
            }

            NavigationLink {
                HomophonesView()
            } label: {
                LibraryFeatureRow(title: "Homophones", subtitle: "Same sound, different meaning across CJK.", icon: "waveform")
            }
        }
    }
}

struct HandwritingInputSheet: View {
    private static let writingArea: Double = 250
    private let canvasSide: CGFloat = 260

    @Environment(\.dismiss) private var dismiss
    @AppStorage("cloudflareBaseURL") private var cloudflareBaseURL = ""

    var initialLanguage: HandwritingRecognitionLanguage
    var onSelect: (String) -> Void

    @State private var language: HandwritingRecognitionLanguage
    @State private var strokes: [HandwritingStroke] = []
    @State private var activeStroke = HandwritingStroke()
    @State private var strokeStart = Date()
    @State private var isDrawing = false
    @State private var candidates: [String] = []
    @State private var status = "Ready"
    @State private var isRecognizing = false

    private let recognitionClient = HandwritingRecognitionClient()

    init(initialLanguage: HandwritingRecognitionLanguage, onSelect: @escaping (String) -> Void) {
        self.initialLanguage = initialLanguage
        self.onSelect = onSelect
        _language = State(initialValue: initialLanguage)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Picker("Language", selection: $language) {
                    ForEach(HandwritingRecognitionLanguage.allCases) { language in
                        Text(language.title).tag(language)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("handwriting.language")

                drawingCanvas

                HStack {
                    Button {
                        undoLastStroke()
                    } label: {
                        Label("Undo", systemImage: "arrow.uturn.backward")
                    }
                    .disabled(strokes.isEmpty)
                    .accessibilityIdentifier("handwriting.undo")

                    Button(role: .destructive) {
                        clearDrawing()
                    } label: {
                        Label("Clear", systemImage: "trash")
                    }
                    .disabled(strokes.isEmpty && activeStroke.isEmpty)
                    .accessibilityIdentifier("handwriting.clear")

                    Spacer()

                    if isRecognizing {
                        ProgressView()
                            .accessibilityIdentifier("handwriting.progress")
                    }
                }

                if !candidates.isEmpty {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 48), spacing: 8)], spacing: 8) {
                        ForEach(candidates, id: \.self) { candidate in
                            Button(candidate) {
                                onSelect(candidate)
                                dismiss()
                            }
                            .buttonStyle(.bordered)
                            .font(.title2)
                            .frame(minWidth: 48, minHeight: 44)
                            .accessibilityIdentifier("handwriting.candidate.\(candidate)")
                        }
                    }
                } else {
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityIdentifier("handwriting.status")
                }

                Spacer(minLength: 0)
            }
            .padding()
            .navigationTitle("Handwriting")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .accessibilityIdentifier("handwriting.close")
                }
            }
            .accessibilityIdentifier("handwriting.sheet")
            .onAppear {
                if let mockCandidates = HandwritingRecognitionClient.mockCandidatesFromEnvironment {
                    candidates = mockCandidates
                    status = "Ready"
                }
            }
            .onChange(of: language) { _, _ in
                candidates = []
                status = "Ready"
                if !strokes.isEmpty {
                    recognize(strokes: strokes)
                }
            }
        }
    }

    private var drawingCanvas: some View {
        ZStack {
            Color(.secondarySystemBackground)
            Canvas { context, size in
                drawGuide(context: &context, size: size)
                for stroke in visibleStrokes {
                    draw(stroke: stroke, context: &context, size: size)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Handwriting canvas")
            .accessibilityIdentifier("handwriting.canvas")
        }
        .frame(width: canvasSide, height: canvasSide)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.secondary.opacity(0.35), lineWidth: 1)
        }
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    handleDragChanged(value)
                }
                .onEnded { value in
                    handleDragEnded(value)
                }
        )
    }

    private var visibleStrokes: [HandwritingStroke] {
        activeStroke.isEmpty ? strokes : strokes + [activeStroke]
    }

    private func drawGuide(context: inout GraphicsContext, size: CGSize) {
        var guide = Path()
        guide.move(to: CGPoint(x: size.width / 2, y: 0))
        guide.addLine(to: CGPoint(x: size.width / 2, y: size.height))
        guide.move(to: CGPoint(x: 0, y: size.height / 2))
        guide.addLine(to: CGPoint(x: size.width, y: size.height / 2))
        guide.move(to: .zero)
        guide.addLine(to: CGPoint(x: size.width, y: size.height))
        guide.move(to: CGPoint(x: size.width, y: 0))
        guide.addLine(to: CGPoint(x: 0, y: size.height))
        context.stroke(
            guide,
            with: .color(.secondary.opacity(0.35)),
            style: StrokeStyle(lineWidth: 0.7, dash: [5, 5])
        )
    }

    private func draw(stroke: HandwritingStroke, context: inout GraphicsContext, size: CGSize) {
        guard !stroke.isEmpty else { return }
        var path = Path()
        for index in stroke.x.indices {
            guard index < stroke.y.count else { continue }
            let point = CGPoint(
                x: CGFloat(stroke.x[index] / Self.writingArea) * size.width,
                y: CGFloat(stroke.y[index] / Self.writingArea) * size.height
            )
            if index == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        context.stroke(
            path,
            with: .color(.primary),
            style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round)
        )
    }

    private func handleDragChanged(_ value: DragGesture.Value) {
        if !isDrawing {
            isDrawing = true
            strokeStart = Date()
            activeStroke = HandwritingStroke()
            candidates = []
            status = "Ready"
        }
        appendPoint(value.location)
    }

    private func handleDragEnded(_ value: DragGesture.Value) {
        appendPoint(value.location)
        isDrawing = false
        guard !activeStroke.isEmpty else { return }
        strokes.append(activeStroke)
        activeStroke = HandwritingStroke()
        recognize(strokes: strokes)
    }

    private func appendPoint(_ location: CGPoint) {
        let clampedX = min(max(location.x, 0), canvasSide)
        let clampedY = min(max(location.y, 0), canvasSide)
        let nextX = Double(clampedX / canvasSide) * Self.writingArea
        let nextY = Double(clampedY / canvasSide) * Self.writingArea
        let elapsed = Date().timeIntervalSince(strokeStart) * 1000

        if
            let lastX = activeStroke.x.last,
            let lastY = activeStroke.y.last,
            abs(lastX - nextX) < 0.5,
            abs(lastY - nextY) < 0.5
        {
            return
        }
        activeStroke.append(x: nextX, y: nextY, t: elapsed)
    }

    private func undoLastStroke() {
        guard !strokes.isEmpty else { return }
        strokes.removeLast()
        candidates = []
        status = "Ready"
        if !strokes.isEmpty {
            recognize(strokes: strokes)
        }
    }

    private func clearDrawing() {
        strokes.removeAll()
        activeStroke = HandwritingStroke()
        candidates = []
        status = "Ready"
        isRecognizing = false
    }

    private func recognize(strokes: [HandwritingStroke]) {
        guard !strokes.isEmpty else { return }
        if let mockCandidates = HandwritingRecognitionClient.mockCandidatesFromEnvironment {
            candidates = mockCandidates
            status = "Ready"
            return
        }

        isRecognizing = true
        status = "Recognizing"
        Task {
            do {
                let recognized = try await recognitionClient.recognize(strokes: strokes, language: language, baseURL: cloudflareBaseURL)
                await MainActor.run {
                    candidates = recognized
                    status = recognized.isEmpty ? "No candidates" : "Ready"
                    isRecognizing = false
                }
            } catch {
                await MainActor.run {
                    candidates = []
                    status = error.localizedDescription
                    isRecognizing = false
                }
            }
        }
    }
}

private struct SearchSentenceBreakdownSection: View {
    @EnvironmentObject private var model: AppModel
    var route: SentenceReaderRoute
    @State private var tokens: [NativeSentenceToken] = []
    @State private var tokenizationTask: Task<Void, Never>?

    var body: some View {
        Section {
            NavigationLink(value: route) {
                HStack(spacing: 10) {
                    Image(systemName: "text.viewfinder")
                        .foregroundStyle(.tint)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Read Sentence")
                            .font(.subheadline.weight(.semibold))
                        Text(route.language.title)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .accessibilityIdentifier("sentenceBreakdown.open")

            FlowLayout(items: tokens) { token in
                if token.isWord {
                    NavigationLink(value: token.lookupText) {
                        SearchSentenceTokenPreview(token: token)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("sentenceBreakdown.token.\(token.lookupText)")
                } else if !token.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(token.text)
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityIdentifier("sentenceBreakdown.tokens")
        } header: {
            Text("Sentence")
        } footer: {
            Text("Tap a token for its entry, or open the reader for the full sentence.")
        }
        .onAppear {
            scheduleTokenization()
        }
        .onDisappear {
            tokenizationTask?.cancel()
        }
        .onChange(of: route) { _, _ in
            scheduleTokenization()
        }
        .onChange(of: model.db != nil) { _, _ in
            scheduleTokenization()
        }
    }

    private func scheduleTokenization() {
        tokenizationTask?.cancel()
        tokens = []
        let sentence = route.sentence
        let language = route.language
        let db = model.db
        tokenizationTask = Task {
            try? await Task.sleep(nanoseconds: 90_000_000)
            guard !Task.isCancelled else { return }
            let next = Array(NativeSentenceTokenizer.tokenize(sentence, language: language, db: db).prefix(48))
            guard !Task.isCancelled else { return }
            tokens = next
        }
    }
}

private struct SearchSentenceTokenPreview: View {
    var token: NativeSentenceToken

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(token.text)
                .font(.callout.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            if !token.reading.isEmpty && token.reading != token.text {
                Text(token.reading)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(.quaternary.opacity(0.55), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

struct SearchResultRow: View {
    var result: SearchResult

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(result.word)
                    .font(.title3.weight(.semibold))
                if !result.pronunciation.isEmpty {
                    Text(result.pronunciation)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(result.language)
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.thinMaterial, in: Capsule())
            }
            Text(result.definitions.prefix(3).joined(separator: "; "))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            if let conjugationInfo = result.conjugationInfo, let resolvedWord = result.resolvedWord {
                Label("\(conjugationInfo) of \(resolvedWord)", systemImage: "arrow.triangle.branch")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if !result.alternativeInflections.isEmpty {
                Text("Also: \(result.alternativeInflections.map { "\($0.conjugationInfo) of \($0.dictionaryForm)" }.joined(separator: "; "))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}

struct DictionaryDetailView: View {
    @EnvironmentObject private var model: AppModel
    var word: String
    @State private var noteText = ""
    @State private var staticSentenceExamples: [StaticSentenceExample] = []
    @State private var reelOccurrences: [GameLanguage: [ReelOccurrence]] = [:]
    @State private var artifactMentions: [ArtifactMention] = []
    @State private var entryNotes: [EntryNote] = []
    @State private var japaneseHomophoneGroups: [JapaneseEntryHomophoneGroup] = []
    @State private var hydratedCharacterSummaries: [CharacterSummary] = []

    var resolved: ResolvedDictionaryLookup? { model.lookupResolved(word) }
    var record: DictionaryRecord? { resolved?.record }
    var inflectionAlternatives: [DictionaryInflectionMatch] {
        let primary = resolved?.inflection?.dictionaryForm
        return model.inflectionAlternatives(word).filter { $0.dictionaryForm != primary }
    }
    var existingNote: UserNote? { model.notes.first(where: { $0.character == word }) }

    var body: some View {
        List {
            if let record {
                let characterForms = record.key.count == 1 ? CharacterFormSummary.forms(for: record) : []
                let visibleCharacterSummaries = characterSummaries(for: record, forms: characterForms)

                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(record.key)
                                .font(.system(size: 34, weight: .semibold, design: .rounded))
                            Spacer()
                            ShareLink(item: record.key) {
                                Image(systemName: "square.and.arrow.up")
                            }
                        }
                        if let redirect = record.redirect {
                            Label("Redirects to \(redirect)", systemImage: "arrow.triangle.turn.up.right.diamond")
                                .foregroundStyle(.secondary)
                        }
                        if let inflection = resolved?.inflection {
                            VStack(alignment: .leading, spacing: 4) {
                                Label("Deinflected from \(inflection.original)", systemImage: "arrow.triangle.branch")
                                    .font(.subheadline.weight(.semibold))
                                Text("\(inflection.conjugationInfo) of \(inflection.dictionaryForm)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if !inflectionAlternatives.isEmpty {
                                    Divider()
                                        .padding(.vertical, 2)
                                    ForEach(inflectionAlternatives, id: \.self) { alternative in
                                        NavigationLink(value: alternative.dictionaryForm) {
                                            HStack {
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(alternative.dictionaryForm)
                                                        .font(.subheadline.weight(.medium))
                                                    Text(alternative.conjugationInfo)
                                                        .font(.caption)
                                                        .foregroundStyle(.secondary)
                                                }
                                                Spacer()
                                                Text("Alternative")
                                                    .font(.caption2.weight(.medium))
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                            }
                            .padding(.top, 4)
                            .accessibilityIdentifier("detail.inflection")
                        }
                    }
                    .padding(.vertical, 2)
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

                if !entryNotes.isEmpty {
                    EntryNotesSection(notes: entryNotes)
                }

                DictionaryNoteEditor(character: record.key, noteText: $noteText, existingNote: existingNote)

                if !characterForms.isEmpty {
                    Section("Character Forms") {
                        CharacterFormsOverview(
                            items: characterForms,
                            summaries: visibleCharacterSummaries,
                            isOnline: model.isOnline
                        )
                    }
                }

                if !record.chineseWordEntries.isEmpty {
                    Section("Chinese") {
                        ForEach(record.chineseWordEntries) { entry in
                            ChineseWordEntryView(entry: entry)
                        }
                    }
                } else {
                    ForEach(record.chinese) { section in
                        Section(section.language.title) {
                            WordSectionView(section: section)
                        }
                    }
                }

                if !record.japaneseWordEntries.isEmpty {
                    Section("Japanese") {
                        ForEach(record.japaneseWordEntries) { entry in
                            JapaneseWordEntryView(
                                entry: entry,
                                labels: record.japaneseLabels,
                                fallbackSection: fallbackJapaneseSection(for: entry, in: record)
                            )
                        }
                    }
                } else {
                    ForEach(record.japanese) { section in
                        Section(section.language.title) {
                            WordSectionView(section: section)
                        }
                    }
                }

                if !record.koreanWordEntries.isEmpty {
                    Section("Korean") {
                        ForEach(record.koreanWordEntries) { entry in
                            KoreanWordEntryView(entry: entry)
                        }
                    }
                } else {
                    ForEach(record.korean) { section in
                        Section(section.language.title) {
                            WordSectionView(section: section)
                        }
                    }
                }

                if !japaneseHomophoneGroups.isEmpty {
                    JapaneseEntryHomophonesSection(groups: japaneseHomophoneGroups)
                }

                if !artifactMentions.isEmpty {
                    ArtifactMentionsSection(word: record.key, mentions: artifactMentions)
                }

                if !staticSentenceExamples.isEmpty {
                    StaticSentenceExamplesSection(examples: staticSentenceExamples)
                }

                reelOccurrenceSections

                if !visibleCharacterSummaries.isEmpty {
                    Section("Characters") {
                        ForEach(visibleCharacterSummaries) { character in
                            CharacterSummaryView(summary: character)
                        }
                    }
                }

                if !record.similarCharacters.isEmpty {
                    SimilarCharactersSection(similarCharacters: record.similarCharacters)
                }

                if !record.japaneseNames.isEmpty {
                    Section("Japanese Names") {
                        ForEach(record.japaneseNames.prefix(12)) { name in
                            JapaneseNameSummaryView(name: name)
                        }
                        if record.japaneseNames.count > 12 {
                            Text("+\(record.japaneseNames.count - 12) more names in the local record")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if !record.contains.isEmpty {
                    EntryPreviewSection(title: "Contains", previews: record.contains)
                }

                if !record.containedInChinese.isEmpty {
                    EntryPreviewSection(title: "Appears In Chinese", previews: record.containedInChinese)
                }

                if !record.containedInJapanese.isEmpty {
                    EntryPreviewSection(title: "Appears In Japanese", previews: record.containedInJapanese)
                }

                if !record.containedInKorean.isEmpty {
                    EntryPreviewSection(title: "Appears In Korean", previews: record.containedInKorean)
                }

                Section("Study") {
                    ForEach(record.allSections.prefix(3)) { section in
                        Button {
                            model.addStudyCard(word: record.key, language: section.language)
                        } label: {
                            Label("Add \(section.language.title) card", systemImage: "plus.rectangle.on.rectangle")
                        }
                    }
                }

                if !record.related.isEmpty {
                    Section("Related") {
                        FlowLayout(items: record.related) { related in
                            NavigationLink(value: related) {
                                Text(related)
                                    .font(.body.weight(.medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.accentColor.opacity(0.12), in: Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("Raw Data") {
                    DisclosureGroup("JSON") {
                        Text(record.rawJSON)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                    }
                }
            } else {
                ContentUnavailableView("No local entry", systemImage: "wifi.slash", description: Text("This word is not in the current native seed database yet. Full import will use output_dictionary and output_search_index.csv."))
                if !entryNotes.isEmpty {
                    EntryNotesSection(notes: entryNotes)
                }
                if !artifactMentions.isEmpty {
                    ArtifactMentionsSection(word: word, mentions: artifactMentions)
                }
                reelOccurrenceSections
            }
        }
        .navigationTitle(word)
        .navigationBarTitleDisplayMode(.inline)
        .listStyle(.plain)
        .listSectionSpacing(.compact)
        .onAppear {
            noteText = existingNote?.noteText ?? ""
        }
        .onChange(of: existingNote?.noteText) { _, newValue in
            noteText = newValue ?? ""
        }
        .task(id: record?.key ?? word) {
            hydrateCharacterSummaries(for: record)
            loadArtifactMentions(for: record)
            loadStaticSentenceExamples(for: record)
            loadReelOccurrences(for: record)
            loadJapaneseHomophones(for: record)
            entryNotes = await model.loadEntryNotes(keys: noteLookupKeys(for: record))
        }
    }

    @ViewBuilder
    private var reelOccurrenceSections: some View {
        ForEach([GameLanguage.ja, .zh].filter { !(reelOccurrences[$0] ?? []).isEmpty }) { language in
            ReelOccurrencesSection(language: language, occurrences: reelOccurrences[language] ?? [])
        }
    }

    private func loadStaticSentenceExamples(for record: DictionaryRecord?) {
        guard let db = model.db, let record else {
            staticSentenceExamples = []
            return
        }

        do {
            var examples: [StaticSentenceExample] = []
            for key in sentenceLookupKeys(for: record, language: .zh) {
                guard examples.count < 24 else { break }
                examples.append(contentsOf: try db.sentenceExamples(word: key, language: .zh, limit: 24 - examples.count))
            }

            var koreanExamples: [StaticSentenceExample] = []
            for key in sentenceLookupKeys(for: record, language: .ko).prefix(8) {
                guard koreanExamples.count < 24 else { break }
                koreanExamples.append(contentsOf: try db.sentenceExamples(word: key, language: .ko, limit: 24 - koreanExamples.count))
            }
            if koreanExamples.isEmpty {
                koreanExamples = try db.sentenceExamples(
                    word: record.key,
                    language: .ko,
                    fallbackWords: record.containedInKorean.map(\.word),
                    limit: 24
                )
            }

            staticSentenceExamples = uniqueStaticSentenceExamples(examples + koreanExamples)
        } catch {
            staticSentenceExamples = []
            model.statusMessage = "Sentence examples unavailable: \(error.localizedDescription)"
        }
    }

    private func loadReelOccurrences(for record: DictionaryRecord?) {
        guard let db = model.db else {
            reelOccurrences = [:]
            return
        }

        do {
            var next: [GameLanguage: [ReelOccurrence]] = [:]
            for language in [GameLanguage.ja, .zh] {
                var languageOccurrences: [ReelOccurrence] = []
                for key in reelLookupKeys(for: record, language: language) {
                    languageOccurrences.append(contentsOf: try db.reelOccurrences(word: key, language: language))
                }
                let unique = uniqueReelOccurrences(languageOccurrences)
                if !unique.isEmpty {
                    next[language] = unique
                }
            }
            reelOccurrences = next
        } catch {
            reelOccurrences = [:]
            model.statusMessage = "Reel examples unavailable: \(error.localizedDescription)"
        }
    }

    private func loadArtifactMentions(for record: DictionaryRecord?) {
        guard let db = model.db else {
            artifactMentions = []
            return
        }

        do {
            var mentions: [ArtifactMention] = []
            for key in artifactMentionLookupKeys(for: record) {
                mentions.append(contentsOf: try db.listArtifactMentions(word: key))
            }
            artifactMentions = uniqueArtifactMentions(mentions)
        } catch {
            artifactMentions = []
            model.statusMessage = "Artifact mentions unavailable: \(error.localizedDescription)"
        }
    }

    private func loadJapaneseHomophones(for record: DictionaryRecord?) {
        guard let db = model.db, let record else {
            japaneseHomophoneGroups = []
            return
        }

        do {
            japaneseHomophoneGroups = try JapaneseEntryHomophoneResolver.groups(for: record, currentWord: word, db: db)
        } catch {
            japaneseHomophoneGroups = []
            model.statusMessage = "Homophones unavailable: \(error.localizedDescription)"
        }
    }

    private func hydrateCharacterSummaries(for record: DictionaryRecord?) {
        guard let db = model.db, let record, record.key.count == 1 else {
            hydratedCharacterSummaries = []
            return
        }

        let forms = CharacterFormSummary.forms(for: record)
        do {
            var loaded: [CharacterSummary] = []
            var seenRecords = Set<String>()
            for form in forms.map(\.form) where seenRecords.insert(form).inserted {
                if form == record.key {
                    continue
                }
                guard let sibling = try db.lookup(word: form) else {
                    continue
                }
                loaded.append(contentsOf: sibling.characters.filter { $0.form == form })
            }
            hydratedCharacterSummaries = loaded
        } catch {
            hydratedCharacterSummaries = []
            model.statusMessage = "Character form details unavailable: \(error.localizedDescription)"
        }
    }

    private func characterSummaries(for record: DictionaryRecord, forms: [CharacterFormSummary]) -> [CharacterSummary] {
        var bestByForm: [String: CharacterSummary] = [:]

        for summary in record.characters + hydratedCharacterSummaries {
            let existing = bestByForm[summary.form]
            bestByForm[summary.form] = preferredCharacterSummary(existing, summary)
        }

        var output: [CharacterSummary] = []
        var seen = Set<String>()
        for form in forms.map(\.form) {
            if let summary = bestByForm[form], seen.insert(summary.form).inserted {
                output.append(summary)
            }
        }

        for summary in record.characters + hydratedCharacterSummaries where seen.insert(summary.form).inserted {
            output.append(summary)
        }

        return output
    }

    private func preferredCharacterSummary(_ current: CharacterSummary?, _ candidate: CharacterSummary) -> CharacterSummary {
        guard let current else { return candidate }
        return characterSummaryScore(candidate) > characterSummaryScore(current) ? candidate : current
    }

    private func characterSummaryScore(_ summary: CharacterSummary) -> Int {
        var score = 0
        if summary.strokeSet?.strokes.isEmpty == false { score += 100 }
        score += summary.components.count * 8
        score += summary.componentUses.count * 5
        score += summary.facts.count * 2
        score += summary.readings.count
        score += summary.meanings.count
        return score
    }

    private func artifactMentionLookupKeys(for record: DictionaryRecord?) -> [String] {
        guard let record else { return uniqueLookupValues([word]) }
        var values = [record.key]
        for section in record.allSections {
            values.append(section.headword)
            values.append(section.reading)
            values.append(contentsOf: splitLookupForms(section.headword))
        }
        return uniqueLookupValues(values)
    }

    private func reelLookupKeys(for record: DictionaryRecord?, language: GameLanguage) -> [String] {
        guard let record else { return uniqueLookupValues([word]) }
        var values = [record.key]
        let sections: [WordSection]
        switch language {
        case .ja:
            sections = record.japanese
        case .zh:
            sections = record.chinese
        case .ko, .tr:
            sections = []
        }
        for section in sections {
            values.append(section.headword)
            values.append(section.reading)
            values.append(contentsOf: splitLookupForms(section.headword))
        }
        return uniqueLookupValues(values)
    }

    private func sentenceLookupKeys(for record: DictionaryRecord, language: LanguageCode) -> [String] {
        let sections: [WordSection]
        switch language {
        case .zh:
            sections = record.chinese
        case .ja:
            sections = record.japanese
        case .ko:
            sections = record.korean
        }

        var values = [record.key]
        for section in sections {
            values.append(section.headword)
            values.append(section.reading)
            values.append(contentsOf: splitLookupForms(section.headword))
        }
        if language == .ko {
            values.append(contentsOf: record.containedInKorean.prefix(30).map(\.word))
        }

        var seen = Set<String>()
        var output: [String] = []
        for value in values.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !value.isEmpty {
            if seen.insert(value).inserted {
                output.append(value)
            }
        }
        return output
    }

    private func noteLookupKeys(for record: DictionaryRecord?) -> [String] {
        guard let record else { return uniqueLookupValues([word]) }
        var values = [record.key, word]
        for section in record.allSections {
            values.append(section.headword)
            values.append(section.reading)
            values.append(contentsOf: splitLookupForms(section.headword))
        }
        for entry in record.chineseWordEntries {
            values.append(entry.simplified)
            values.append(entry.traditional)
        }
        for entry in record.japaneseWordEntries {
            values.append(contentsOf: entry.visibleKanji.map(\.text))
            values.append(contentsOf: entry.visibleKana.map(\.text))
        }
        for entry in record.koreanWordEntries {
            values.append(entry.hanja)
            values.append(entry.hangul)
        }
        for character in record.characters {
            values.append(character.form)
            values.append(contentsOf: character.variants.map(\.character))
        }
        return uniqueLookupValues(values)
    }

    private func splitLookupForms(_ value: String) -> [String] {
        value
            .components(separatedBy: CharacterSet(charactersIn: "、/;，,\n\t"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func uniqueStaticSentenceExamples(_ values: [StaticSentenceExample]) -> [StaticSentenceExample] {
        var seen = Set<String>()
        var output: [StaticSentenceExample] = []
        for value in values {
            let key = "\(value.language.rawValue)-\(value.text)-\(value.translation)"
            if seen.insert(key).inserted {
                output.append(value)
            }
        }
        return output
    }

    private func uniqueLookupValues(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var output: [String] = []
        for value in values.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !value.isEmpty {
            if seen.insert(value).inserted {
                output.append(value)
            }
        }
        return output
    }

    private func uniqueArtifactMentions(_ values: [ArtifactMention]) -> [ArtifactMention] {
        var order: [String] = []
        var artifacts: [String: Artifact] = [:]
        var sentences: [String: [ArtifactSentence]] = [:]
        var seenSentences = Set<String>()

        for mention in values {
            if artifacts[mention.id] == nil {
                order.append(mention.id)
                artifacts[mention.id] = mention.artifact
            }
            for sentence in mention.sentences where seenSentences.insert(sentence.id).inserted {
                sentences[mention.id, default: []].append(sentence)
            }
        }

        return order.compactMap { id in
            guard let artifact = artifacts[id] else { return nil }
            return ArtifactMention(artifact: artifact, sentences: sentences[id] ?? [])
        }
    }

    private func uniqueReelOccurrences(_ values: [ReelOccurrence]) -> [ReelOccurrence] {
        var seen = Set<String>()
        var output: [ReelOccurrence] = []
        for value in values {
            if seen.insert(value.id).inserted {
                output.append(value)
            }
        }
        return output
    }

    private func fallbackJapaneseSection(for entry: JapaneseWordEntry, in record: DictionaryRecord) -> WordSection {
        record.japanese.first { section in
            section.headword == entry.displayHeadword ||
            entry.visibleKanji.contains(where: { $0.text == section.headword }) ||
            entry.visibleKana.contains(where: { $0.text == section.reading })
        } ?? entry.flattenedSection()
    }
}

struct JapaneseEntryHomophonesSection: View {
    var groups: [JapaneseEntryHomophoneGroup]

    var body: some View {
        Section("Homophones") {
            ForEach(groups) { group in
                VStack(alignment: .leading, spacing: 8) {
                    if groups.count > 1 {
                        Text(group.reading)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    FlowLayout(items: group.words) { result in
                        NavigationLink(value: result.word) {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 5) {
                                    Text(result.word)
                                        .font(.subheadline.weight(.semibold))
                                    if result.isCommon {
                                        Image(systemName: "star.fill")
                                            .font(.caption2)
                                            .foregroundStyle(.yellow)
                                            .accessibilityLabel("Common")
                                    }
                                }
                                if !result.definitions.isEmpty {
                                    Text(result.definitions.prefix(2).joined(separator: "; "))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(.quaternary.opacity(0.65), in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("entryHomophone.\(result.word)")
                    }
                }
                .padding(.vertical, 4)
                .accessibilityIdentifier("entryHomophoneGroup.\(group.reading)")
            }
        }
    }
}

struct EntryNotesSection: View {
    var notes: [EntryNote]

    private var myNotes: [EntryNote] {
        notes.filter { $0.isLocalUser }
    }

    private var officialNotes: [EntryNote] {
        notes.filter { !$0.isLocalUser && $0.isAdmin }
    }

    private var communityNotes: [EntryNote] {
        notes.filter { !$0.isLocalUser && !$0.isAdmin }
    }

    var body: some View {
        Section("Notes") {
            ForEach(myNotes) { note in
                EntryNoteRow(note: note, title: "Your Note", systemImage: "person.crop.circle")
            }
            ForEach(officialNotes) { note in
                EntryNoteRow(note: note, title: "Official Note", systemImage: "checkmark.seal")
            }
            ForEach(communityNotes) { note in
                EntryNoteRow(note: note, title: note.displayName, systemImage: "person.2")
            }
        }
    }
}

struct EntryNoteRow: View {
    var note: EntryNote
    var title: String
    var systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .center, spacing: 8) {
                Label(title, systemImage: systemImage)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(note.isLocalUser ? Color.accentColor : Color.secondary)
                if note.dirty {
                    MetadataChip(text: "Pending sync", systemImage: "arrow.triangle.2.circlepath")
                }
                Spacer(minLength: 0)
            }
            NoteMarkdownView(text: note.noteText)
                .font(.callout)
                .accessibilityIdentifier("entryNote.\(note.character).\(note.id)")
        }
        .padding(.vertical, 2)
    }
}

struct DictionaryNoteEditor: View {
    @EnvironmentObject private var model: AppModel
    var character: String
    @Binding var noteText: String
    var existingNote: UserNote?
    @State private var photoItem: PhotosPickerItem?
    @State private var isImportingImage = false

    var body: some View {
        Section("Your Note") {
            ZStack(alignment: .topLeading) {
                if noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("Add a mnemonic, memory hook, or usage note")
                        .font(.callout)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 8)
                }
                TextEditor(text: $noteText)
                    .frame(minHeight: 78)
                    .accessibilityIdentifier("note.editor")
            }

            HStack(spacing: 12) {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Image(systemName: "photo.badge.plus")
                }
                .disabled(isImportingImage)
                .accessibilityLabel("Attach image")
                .accessibilityIdentifier("note.attachImage")

                if existingNote?.dirty == true {
                    MetadataChip(text: "Pending sync", systemImage: "arrow.triangle.2.circlepath")
                }

                Spacer()

                Button {
                    model.saveNote(character: character, text: noteText)
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                }
                .disabled(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("note.save")
            }
        }
        .onChange(of: photoItem) { _, item in
            Task {
                guard let item else { return }
                await MainActor.run {
                    isImportingImage = true
                }
                guard let data = try? await item.loadTransferable(type: Data.self) else {
                    await MainActor.run {
                        isImportingImage = false
                        photoItem = nil
                    }
                    return
                }
                await MainActor.run {
                    if let markdown = model.makeNoteImageMarkdown(character: character, data: data) {
                        appendImageMarkdown(markdown)
                    }
                    isImportingImage = false
                    photoItem = nil
                }
            }
        }
    }

    private func appendImageMarkdown(_ markdown: String) {
        let trimmed = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            noteText = markdown
        } else if noteText.hasSuffix("\n\n") {
            noteText += markdown
        } else if noteText.hasSuffix("\n") {
            noteText += "\n\(markdown)"
        } else {
            noteText += "\n\n\(markdown)"
        }
    }
}

struct NoteMarkdownBlock: Identifiable, Hashable {
    enum Content: Hashable {
        case markdown(String)
        case image(alt: String, url: String)
    }

    var id: Int
    var content: Content
}

enum NoteMarkdownParser {
    static func blocks(from text: String) -> [NoteMarkdownBlock] {
        let pattern = #"!\[([^\]]*)\]\(([^)]+)\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return text.isEmpty ? [] : [NoteMarkdownBlock(id: 0, content: .markdown(text))]
        }

        let nsText = text as NSString
        let fullRange = NSRange(location: 0, length: nsText.length)
        var cursor = 0
        var output: [NoteMarkdownBlock] = []

        for match in regex.matches(in: text, range: fullRange) {
            if match.range.location > cursor {
                appendMarkdown(nsText.substring(with: NSRange(location: cursor, length: match.range.location - cursor)), to: &output)
            }
            let alt = match.range(at: 1).location == NSNotFound ? "" : nsText.substring(with: match.range(at: 1))
            let url = match.range(at: 2).location == NSNotFound ? "" : nsText.substring(with: match.range(at: 2))
            output.append(NoteMarkdownBlock(id: output.count, content: .image(alt: alt, url: url)))
            cursor = match.range.location + match.range.length
        }

        if cursor < nsText.length {
            appendMarkdown(nsText.substring(from: cursor), to: &output)
        }

        if output.isEmpty && !text.isEmpty {
            output.append(NoteMarkdownBlock(id: 0, content: .markdown(text)))
        }
        return output.enumerated().map { index, block in
            NoteMarkdownBlock(id: index, content: block.content)
        }
    }

    private static func appendMarkdown(_ text: String, to output: inout [NoteMarkdownBlock]) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        output.append(NoteMarkdownBlock(id: output.count, content: .markdown(text)))
    }
}

struct NoteMarkdownView: View {
    var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(NoteMarkdownParser.blocks(from: text)) { block in
                switch block.content {
                case .markdown(let markdown):
                    if let attributed = try? AttributedString(markdown: markdown) {
                        Text(attributed)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    } else {
                        Text(markdown)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                case .image(let alt, let url):
                    NoteMarkdownImageView(alt: alt, urlString: url)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct NoteMarkdownImageView: View {
    @EnvironmentObject private var model: AppModel
    var alt: String
    var urlString: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            image
                .frame(maxWidth: .infinity)
                .frame(maxHeight: 280)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(.secondary.opacity(0.25), lineWidth: 1)
                }
                .accessibilityIdentifier("note.image")

            if !alt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(alt)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var image: some View {
        if let localURL, let uiImage = UIImage(contentsOfFile: localURL.path) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFit()
        } else if let remoteURL {
            AsyncImage(url: remoteURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                case .failure:
                    placeholder
                case .empty:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 140)
                @unknown default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(.quaternary)
            .frame(maxWidth: .infinity, minHeight: 140)
            .overlay(Image(systemName: "photo").foregroundStyle(.secondary))
    }

    private var localURL: URL? {
        guard let id = LocalDatabase.noteImageId(from: urlString) else { return nil }
        return model.db?.localNoteImageURL(id: id)
    }

    private var remoteURL: URL? {
        if urlString.hasPrefix("http://") || urlString.hasPrefix("https://") {
            return URL(string: urlString)
        }
        guard urlString.hasPrefix("/api/"),
              let raw = UserDefaults.standard.string(forKey: "cloudflareBaseURL"),
              let baseURL = URL(string: raw)
        else { return nil }
        return URL(string: urlString, relativeTo: baseURL)?.absoluteURL
    }
}

struct ArtifactMentionsSection: View {
    var word: String
    var mentions: [ArtifactMention]

    var body: some View {
        Section("Found In Artifacts") {
            ForEach(mentions) { mention in
                NavigationLink {
                    ArtifactDetailView(artifact: mention.artifact)
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Image(systemName: artifactTypeSymbol(mention.artifact.type))
                                .foregroundStyle(.secondary)
                                .frame(width: 20)
                            Text(mention.artifact.title)
                                .font(.headline)
                            Spacer()
                            Text(mention.artifact.language.title)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)
                        }

                        ForEach(mention.sentences.prefix(2)) { sentence in
                            VStack(alignment: .leading, spacing: 3) {
                                HighlightedArtifactSentence(text: sentence.originalText, highlight: word)
                                    .font(.subheadline)
                                if !sentence.translation.isEmpty {
                                    Text(sentence.translation)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }

                        if mention.sentences.count > 2 {
                            Text("+\(mention.sentences.count - 2) more sentences")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .accessibilityIdentifier("artifactMention.\(mention.id)")
            }
        }
    }
}

struct HighlightedArtifactSentence: View {
    var text: String
    var highlight: String

    var body: some View {
        textView()
    }

    private func textView() -> Text {
        let target = highlight.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !target.isEmpty, let range = text.range(of: target) else {
            return Text(text)
        }

        let before = String(text[..<range.lowerBound])
        let match = String(text[range])
        let after = String(text[range.upperBound...])
        return Text(before)
            + Text(match).foregroundColor(.accentColor).bold()
            + Text(after)
    }
}

func artifactTypeSymbol(_ type: String) -> String {
    switch type {
    case "packaging": "shippingbox"
    case "sign": "signpost.right"
    case "menu": "menucard"
    case "book": "book"
    case "media": "play.rectangle"
    default: "paperclip"
    }
}

struct ReelOccurrencesSection: View {
    var language: GameLanguage
    var occurrences: [ReelOccurrence]
    @State private var visibleCount = 10

    private var visibleOccurrences: [ReelOccurrence] {
        Array(occurrences.prefix(visibleCount))
    }

    var body: some View {
        Section("\(language.title) Reels (\(occurrences.count))") {
            ForEach(visibleOccurrences) { occurrence in
                NavigationLink {
                    ReelDetailView(videoId: occurrence.videoId, language: occurrence.language)
                } label: {
                    ReelOccurrenceRow(occurrence: occurrence)
                }
                .accessibilityIdentifier("reelOccurrence.\(occurrence.language.rawValue).\(occurrence.videoId)")
            }
            if visibleCount < occurrences.count {
                Button("Load more (\(occurrences.count - visibleCount) remaining)") {
                    visibleCount += 10
                }
                .accessibilityIdentifier("reelOccurrence.loadMore.\(language.rawValue)")
            }
        }
        .accessibilityIdentifier("reelOccurrences.\(language.rawValue)")
    }
}

struct ReelOccurrenceRow: View {
    var occurrence: ReelOccurrence

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack(alignment: .bottomLeading) {
                ReelThumbnail(urlString: occurrence.video?.thumbnail ?? "")
                    .frame(width: 58, height: 92)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Text(formatReelTime(occurrence.startTime))
                    .font(.caption2.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 3)
                    .background(.black.opacity(0.68), in: Capsule())
                    .padding(5)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(occurrence.word)
                        .font(.headline)
                    if let author = occurrence.video?.author, !author.isEmpty {
                        Text(author)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Text(occurrence.sentence)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                if let video = occurrence.video {
                    HStack(spacing: 10) {
                        if let duration = video.duration {
                            Label(formatReelTime(duration), systemImage: "clock")
                        }
                        Label("\(video.wordCount)", systemImage: "textformat")
                    }
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 3)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("reelOccurrence.\(occurrence.language.rawValue).\(occurrence.videoId)")
    }
}

struct CharacterFormsOverview: View {
    var items: [CharacterFormSummary]
    var summaries: [CharacterSummary] = []
    var isOnline: Bool = false

    private var summaryByForm: [String: CharacterSummary] {
        Dictionary(uniqueKeysWithValues: summaries.map { ($0.form, $0) })
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(items) { item in
                    CharacterFormCard(item: item, summary: summaryByForm[item.form], isOnline: isOnline)
                }
            }
            .padding(.vertical, 2)
        }
        .accessibilityIdentifier("characterForms.overview")
    }
}

struct CharacterFormCard: View {
    var item: CharacterFormSummary
    var summary: CharacterSummary?
    var isOnline: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            formPreview

            Text(item.labelText)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .minimumScaleFactor(0.75)

            if !item.readings.isEmpty {
                Text(item.readings.prefix(3).joined(separator: " / "))
                    .font(.caption.monospaced())
                    .foregroundStyle(.blue)
                    .lineLimit(2)
            }

            if !item.meanings.isEmpty {
                Text(item.meanings.prefix(2).joined(separator: "; "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            if !item.tags.isEmpty {
                FlowLayout(items: Array(item.tags.prefix(3))) { tag in
                    MetadataChip(text: tag)
                }
            }
        }
        .frame(width: 150, alignment: .topLeading)
        .padding(10)
        .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityIdentifier("characterForms.\(item.form)")
    }

    @ViewBuilder
    private var formPreview: some View {
        if let strokeSet = summary?.strokeSet, !strokeSet.strokes.isEmpty {
            Group {
                if isOnline {
                    AnimatedStrokeOrderGlyph(strokeSet: strokeSet)
                } else {
                    StaticStrokeOrderGlyph(strokeSet: strokeSet)
                }
            }
            .frame(width: 96, height: 96)
            .accessibilityIdentifier("characterForms.stroke.\(item.form)")
        } else if isOnline {
            RemoteStrokeOrderGlyph(form: item.form, fallbackFontSize: 52)
                .frame(width: 96, height: 96)
                .accessibilityIdentifier("characterForms.stroke.\(item.form)")
        } else {
            Text(item.form)
                .font(.system(size: 52, weight: .semibold, design: .rounded))
                .frame(width: 96, height: 96, alignment: .center)
                .background(.quaternary.opacity(0.45), in: RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct CharacterSummaryView: View {
    @EnvironmentObject private var model: AppModel
    var summary: CharacterSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(summary.form)
                    .font(.system(size: 36, weight: .semibold, design: .rounded))
                VStack(alignment: .leading, spacing: 3) {
                    Text(summary.variantLabel)
                        .font(.headline)
                    if !summary.readings.isEmpty {
                        Text(summary.readings.prefix(6).joined(separator: " / "))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if !summary.meanings.isEmpty {
                Text(summary.meanings.prefix(6).joined(separator: "; "))
                    .font(.body)
            }

            if !summary.components.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Components")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("Equation")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(Array(summary.components.prefix(8).enumerated()), id: \.element.id) { index, component in
                                if index > 0 {
                                    Text("+")
                                        .foregroundStyle(.secondary)
                                }
                                NavigationLink(value: component.character) {
                                    VStack(spacing: 2) {
                                        Text(component.character)
                                            .font(.title3.weight(.semibold))
                                        if !component.meaning.isEmpty {
                                            Text(component.meaning)
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        }
                                        if !component.role.isEmpty {
                                            Text(component.role)
                                                .font(.caption2.weight(.medium))
                                                .foregroundStyle(.tertiary)
                                                .lineLimit(1)
                                        }
                                    }
                                    .frame(minWidth: 44)
                                }
                                .buttonStyle(.plain)
                            }
                            Text("=")
                                .foregroundStyle(.secondary)
                            Text(summary.form)
                                .font(.title3.weight(.bold))
                        }
                    }
                    CharacterComponentCardsView(components: summary.components, strokeSet: summary.strokeSet)
                }
            }

            if summary.strokeSet?.strokes.isEmpty == false || model.isOnline {
                CharacterStrokeOrderView(form: summary.form, strokeSet: summary.strokeSet, isOnline: model.isOnline)
            }

            if !summary.componentUses.isEmpty {
                CharacterComponentUsesView(summary: summary)
            }

            if !summary.tags.isEmpty {
                FlowLayout(items: summary.tags) { tag in
                    MetadataChip(text: tag)
                }
            }

            if !summary.facts.isEmpty {
                CharacterFactsView(facts: summary.facts)
            }

            if !summary.variants.isEmpty {
                CharacterVariantsView(variants: summary.variants)
            }

            if !summary.topWords.isEmpty {
                CharacterTopWordsView(topWords: summary.topWords)
            }

            if !summary.oldPronunciations.isEmpty {
                CharacterPronunciationHistoryView(rows: summary.oldPronunciations)
            }

            if !summary.images.isEmpty {
                CharacterHistoricalEvolutionView(form: summary.form, images: summary.images)
            }

            if !summary.comments.isEmpty {
                CharacterCommentsView(comments: summary.comments)
            }

            if summary.form.count == 1 {
                NavigationLink {
                    PhoneticSeriesView(component: summary.form)
                } label: {
                    Label("Phonetic series", systemImage: "point.3.connected.trianglepath.dotted")
                        .font(.subheadline.weight(.medium))
                }
                .accessibilityIdentifier("phonetic.open.\(summary.form)")
            }

            ForEach(summary.notes.prefix(2), id: \.self) { note in
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
        .accessibilityIdentifier("characterSummary.\(summary.language.rawValue).\(summary.form)")
    }
}

struct CharacterStrokeOrderView: View {
    var form: String
    var strokeSet: CharacterStrokeSet?
    var isOnline: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Stroke Order")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let strokeSet, !strokeSet.strokes.isEmpty {
                    MetadataChip(text: "\(strokeSet.strokes.count) strokes")
                } else if isOnline {
                    MetadataChip(text: "online")
                }
            }
            Group {
                if let strokeSet, !strokeSet.strokes.isEmpty, isOnline {
                    AnimatedStrokeOrderGlyph(strokeSet: strokeSet)
                } else if let strokeSet, !strokeSet.strokes.isEmpty {
                    StaticStrokeOrderGlyph(strokeSet: strokeSet)
                } else if isOnline {
                    RemoteStrokeOrderGlyph(form: form)
                } else {
                    EmptyView()
                }
            }
            .frame(width: 132, height: 132)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityIdentifier("characterStrokeOrder.\(form)")
    }
}

private struct HanziWriterStrokePayload: Decodable {
    var strokes: [String]
}

struct RemoteStrokeOrderGlyph: View {
    var form: String
    var fallbackFontSize: CGFloat = 42
    @State private var strokeSet: CharacterStrokeSet?
    @State private var didFail = false

    var body: some View {
        Group {
            if let strokeSet, !strokeSet.strokes.isEmpty {
                AnimatedStrokeOrderGlyph(strokeSet: strokeSet)
            } else {
                fallbackGlyph
                    .overlay(alignment: .bottomTrailing) {
                        if strokeSet == nil && !didFail {
                            ProgressView()
                                .controlSize(.mini)
                                .padding(6)
                        }
                    }
            }
        }
        .task(id: form) {
            await load()
        }
    }

    private var fallbackGlyph: some View {
        Text(form)
            .font(.system(size: fallbackFontSize, weight: .semibold, design: .rounded))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.quaternary.opacity(0.45), in: RoundedRectangle(cornerRadius: 8))
    }

    private func load() async {
        guard strokeSet == nil, !didFail, form.count == 1 else { return }
        guard let encoded = form.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              let url = URL(string: "https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/\(encoded).json")
        else {
            didFail = true
            return
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                didFail = true
                return
            }
            let payload = try JSONDecoder().decode(HanziWriterStrokePayload.self, from: data)
            strokeSet = CharacterStrokeSet(source: "hanzi-writer-data", strokes: payload.strokes, matches: [])
        } catch {
            didFail = true
        }
    }
}

struct StaticStrokeOrderGlyph: View {
    var strokeSet: CharacterStrokeSet

    var body: some View {
        ZStack {
            ForEach(Array(strokeSet.strokes.enumerated()), id: \.offset) { _, stroke in
                HanziStrokeShape(pathData: stroke)
                    .fill(Color.primary)
            }
        }
        .padding(10)
        .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct AnimatedStrokeOrderGlyph: View {
    var strokeSet: CharacterStrokeSet
    @State private var startDate = Date()

    var body: some View {
        TimelineView(.animation) { timeline in
            let count = max(strokeSet.strokes.count, 1)
            let frame = Int(timeline.date.timeIntervalSince(startDate) / 0.55) % (count + 2)
            ZStack {
                ForEach(Array(strokeSet.strokes.enumerated()), id: \.offset) { index, stroke in
                    HanziStrokeShape(pathData: stroke)
                        .fill(index < frame ? Color.accentColor : Color.secondary.opacity(0.20))
                        .animation(.easeInOut(duration: 0.22), value: frame)
                }
            }
            .padding(10)
            .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
        }
        .onAppear { startDate = Date() }
    }
}

struct CharacterComponentCardsView: View {
    var components: [CharacterComponent]
    var strokeSet: CharacterStrokeSet?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(components.prefix(12)) { component in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .top, spacing: 10) {
                        ComponentPreview(component: component, strokeSet: strokeSet)

                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                NavigationLink(value: component.character) {
                                    Text(component.character)
                                        .font(.title3.weight(.semibold))
                                }
                                .buttonStyle(.plain)

                                if !component.roleLabel.isEmpty {
                                    MetadataChip(text: component.roleLabel)
                                        .accessibilityIdentifier("componentCard.role.\(component.character)")
                                }
                            }

                            if !component.pinyin.isEmpty || !component.meaning.isEmpty {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    if !component.pinyin.isEmpty {
                                        Text(component.pinyin)
                                            .font(.caption.monospaced())
                                            .foregroundStyle(.blue)
                                    }
                                    if !component.meaning.isEmpty {
                                        Text(component.meaning)
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                    }
                                }
                            }

                            if !component.secondaryMeaning.isEmpty {
                                Text(component.secondaryMeaning)
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                                    .lineLimit(2)
                            }

                            if !component.hint.isEmpty {
                                Text(component.hint)
                                    .font(.caption)
                                    .italic()
                                    .foregroundStyle(.tertiary)
                                    .lineLimit(2)
                            }

                            if component.isPhonetic {
                                NavigationLink {
                                    PhoneticSeriesView(component: component.character)
                                } label: {
                                    Label("Phonetic series", systemImage: "point.3.connected.trianglepath.dotted")
                                        .font(.caption.weight(.semibold))
                                }
                                .accessibilityIdentifier("componentCard.phonetic.\(component.character)")
                            }
                        }
                    }
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityIdentifier("componentCard.\(component.character)")
            }
        }
    }
}

struct ComponentPreview: View {
    var component: CharacterComponent
    var strokeSet: CharacterStrokeSet?

    var body: some View {
        NavigationLink(value: component.character) {
            Group {
                if let strokeSet, !strokeSet.strokes.isEmpty {
                    ComponentStrokePreview(component: component, strokeSet: strokeSet)
                } else {
                    componentGlyph
                }
            }
            .frame(width: 52, height: 52)
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private var componentGlyph: some View {
        Text(component.character)
            .font(.system(size: 30, weight: .semibold, design: .serif))
    }
}

struct ComponentStrokePreview: View {
    var component: CharacterComponent
    var strokeSet: CharacterStrokeSet

    private var highlightedStrokes: Set<Int> {
        let matches = strokeSet.matches
        guard !matches.isEmpty else {
            if strokeSet.strokes.count == 1 || component.componentIndex == 0 {
                return Set(strokeSet.strokes.indices)
            }
            return []
        }
        let selected = matches.enumerated().compactMap { index, values -> Int? in
            values.contains(component.componentIndex) ? index : nil
        }
        if selected.isEmpty, componentsShouldReceiveAllStrokes {
            return Set(strokeSet.strokes.indices)
        }
        return Set(selected)
    }

    private var componentsShouldReceiveAllStrokes: Bool {
        strokeSet.matches.isEmpty && component.componentIndex == 0
    }

    var body: some View {
        ZStack {
            ForEach(Array(strokeSet.strokes.enumerated()), id: \.offset) { index, stroke in
                HanziStrokeShape(pathData: stroke)
                    .fill(highlightedStrokes.contains(index) ? component.highlightColor : Color.secondary.opacity(0.28))
            }
        }
        .padding(4)
        .accessibilityIdentifier("componentStrokePreview.\(component.character)")
        .accessibilityLabel("\(component.character) component stroke preview")
    }
}

struct HanziStrokeShape: Shape {
    var pathData: String

    func path(in rect: CGRect) -> Path {
        SVGPathParser.path(from: pathData, in: rect)
    }
}

enum SVGPathParser {
    static func path(from pathData: String, in rect: CGRect) -> Path {
        var cursor = SVGCursor(tokens: tokenize(pathData))
        var path = Path()
        var command: Character?
        var current = CGPoint.zero
        var start = CGPoint.zero

        while let token = cursor.peek {
            if let nextCommand = token.first, isCommand(nextCommand) {
                command = nextCommand
                cursor.advance()
            }
            guard let activeCommand = command else { break }
            let isRelative = activeCommand.isLowercase

            switch activeCommand.uppercased() {
            case "M":
                guard let point = cursor.readPoint(relativeTo: current, isRelative: isRelative, rect: rect) else { return path }
                current = point
                start = point
                path.move(to: point)
                command = isRelative ? "l" : "L"
            case "L":
                guard let point = cursor.readPoint(relativeTo: current, isRelative: isRelative, rect: rect) else { return path }
                current = point
                path.addLine(to: point)
            case "H":
                guard let x = cursor.readNumber() else { return path }
                let point = convertPoint(
                    CGPoint(x: isRelative ? current.x + scaleX(x, rect: rect) : scaleX(x, rect: rect), y: current.y),
                    alreadyConverted: true
                )
                current = point
                path.addLine(to: point)
            case "V":
                guard let y = cursor.readNumber() else { return path }
                let point = CGPoint(x: current.x, y: isRelative ? current.y - scaleY(y, rect: rect) : flippedY(y, rect: rect))
                current = point
                path.addLine(to: point)
            case "C":
                guard
                    let c1 = cursor.readPoint(relativeTo: current, isRelative: isRelative, rect: rect),
                    let c2 = cursor.readPoint(relativeTo: current, isRelative: isRelative, rect: rect),
                    let end = cursor.readPoint(relativeTo: current, isRelative: isRelative, rect: rect)
                else { return path }
                current = end
                path.addCurve(to: end, control1: c1, control2: c2)
            case "Q":
                guard
                    let control = cursor.readPoint(relativeTo: current, isRelative: isRelative, rect: rect),
                    let end = cursor.readPoint(relativeTo: current, isRelative: isRelative, rect: rect)
                else { return path }
                current = end
                path.addQuadCurve(to: end, control: control)
            case "Z":
                path.closeSubpath()
                current = start
                command = nil
            default:
                cursor.advance()
            }
        }

        return path
    }

    private static func tokenize(_ value: String) -> [String] {
        var tokens: [String] = []
        let scalars = Array(value.unicodeScalars)
        var index = scalars.startIndex

        while index < scalars.endIndex {
            let scalar = scalars[index]
            if CharacterSet.whitespacesAndNewlines.contains(scalar) || scalar == "," {
                index += 1
                continue
            }
            let character = Character(scalar)
            if isCommand(character) {
                tokens.append(String(character))
                index += 1
                continue
            }

            let start = index
            if scalar == "-" || scalar == "+" {
                index += 1
            }
            var hasDecimal = false
            while index < scalars.endIndex {
                let next = scalars[index]
                if next == "." && !hasDecimal {
                    hasDecimal = true
                    index += 1
                    continue
                }
                if next == "e" || next == "E" {
                    index += 1
                    if index < scalars.endIndex, scalars[index] == "-" || scalars[index] == "+" {
                        index += 1
                    }
                    continue
                }
                guard CharacterSet.decimalDigits.contains(next) else { break }
                index += 1
            }

            if start < index {
                tokens.append(String(String.UnicodeScalarView(scalars[start..<index])))
            } else {
                index += 1
            }
        }

        return tokens
    }

    fileprivate static func isCommand(_ character: Character) -> Bool {
        "MmLlHhVvCcQqZz".contains(character)
    }

    fileprivate static func convertRawPoint(_ x: Double, _ y: Double, rect: CGRect) -> CGPoint {
        CGPoint(x: scaleX(x, rect: rect), y: flippedY(y, rect: rect))
    }

    fileprivate static func offsetPoint(_ x: Double, _ y: Double, from point: CGPoint, rect: CGRect) -> CGPoint {
        CGPoint(x: point.x + scaleX(x, rect: rect), y: point.y - scaleY(y, rect: rect))
    }

    private static func scaleX(_ x: Double, rect: CGRect) -> CGFloat {
        rect.minX + CGFloat(x / 1024.0) * rect.width
    }

    private static func scaleY(_ y: Double, rect: CGRect) -> CGFloat {
        CGFloat(y / 1024.0) * rect.height
    }

    private static func flippedY(_ y: Double, rect: CGRect) -> CGFloat {
        rect.minY + CGFloat((900.0 - y) / 1024.0) * rect.height
    }

    private static func convertPoint(_ point: CGPoint, alreadyConverted: Bool) -> CGPoint {
        point
    }
}

private struct SVGCursor {
    var tokens: [String]
    var index = 0

    var peek: String? {
        guard index < tokens.count else { return nil }
        return tokens[index]
    }

    mutating func advance() {
        index += 1
    }

    mutating func readNumber() -> Double? {
        guard let token = peek, token.first.map({ !SVGPathParser.isCommand($0) }) == true else { return nil }
        advance()
        return Double(token)
    }

    mutating func readPoint(relativeTo current: CGPoint, isRelative: Bool, rect: CGRect) -> CGPoint? {
        guard let x = readNumber(), let y = readNumber() else { return nil }
        if isRelative {
            return SVGPathParser.offsetPoint(x, y, from: current, rect: rect)
        }
        return SVGPathParser.convertRawPoint(x, y, rect: rect)
    }
}

struct CharacterComponentUsesView: View {
    var summary: CharacterSummary
    @State private var expanded = false
    private let collapsedMaxCharacters = 20

    private var totalCount: Int {
        summary.componentUses.reduce(0) { $0 + $1.count }
    }

    private var totalVerified: Int {
        summary.componentUses.reduce(0) { $0 + $1.verified }
    }

    private var needsCollapse: Bool {
        summary.componentUses.contains { $0.chars.count > collapsedMaxCharacters }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Component Uses")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("characterComponentUses.\(summary.language.rawValue).\(summary.form)")
                Text("\(totalCount) characters, \(totalVerified) verified")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            ForEach(summary.componentUses) { group in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(group.displayName)
                            .font(.subheadline.weight(.semibold))
                            .accessibilityIdentifier("componentUse.\(group.role)")
                        Text("in \(group.count) characters (\(group.verified) verified)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    FlowLayout(items: visibleCharacters(for: group)) { character in
                        NavigationLink(value: character) {
                            Text(character)
                                .font(.headline.weight(.semibold))
                                .frame(minWidth: 36, minHeight: 32)
                                .padding(.horizontal, 8)
                                .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("componentUse.char.\(character)")
                    }

                    if !expanded && group.chars.count > collapsedMaxCharacters {
                        Text("+\(group.chars.count - collapsedMaxCharacters) more")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if needsCollapse {
                Button {
                    expanded.toggle()
                } label: {
                    Label(expanded ? "Show fewer" : "Show all", systemImage: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderless)
            }
        }
    }

    private func visibleCharacters(for group: CharacterComponentUseGroup) -> [String] {
        if expanded {
            return group.chars
        }
        return Array(group.chars.prefix(collapsedMaxCharacters))
    }
}

struct CharacterFactsView: View {
    var facts: [CharacterFact]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Facts")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ForEach(facts.prefix(12)) { fact in
                HStack(alignment: .firstTextBaseline) {
                    Text(fact.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 96, alignment: .leading)
                    Text(fact.value)
                        .font(.caption)
                        .textSelection(.enabled)
                }
            }
        }
    }
}

struct CharacterVariantsView: View {
    var variants: [CharacterVariantSummary]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Variants")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            FlowLayout(items: variants) { variant in
                NavigationLink(value: variant.character) {
                    VStack(spacing: 2) {
                        Text(variant.character)
                            .font(.headline)
                        Text(uniqueNonEmpty([variant.label, variant.source]).joined(separator: " · "))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct CharacterTopWordsView: View {
    var topWords: [CharacterTopWord]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Top Words")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ForEach(topWords.prefix(8)) { item in
                NavigationLink(value: item.word) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(item.word)
                            .font(.subheadline.weight(.semibold))
                        if !item.traditional.isEmpty && item.traditional != item.word {
                            Text(item.traditional)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if !item.gloss.isEmpty {
                            Text(item.gloss)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        if let share = item.share {
                            Text(share.formatted(.number.precision(.fractionLength(0...2))))
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }
        }
    }
}

struct CharacterPronunciationHistoryView: View {
    var rows: [CharacterPronunciationHistory]

    var body: some View {
        DisclosureGroup("Historical Pronunciations (\(rows.count))") {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(rows.prefix(10)) { row in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(row.pinyin)
                            .font(.subheadline.weight(.semibold))
                        Text(uniqueNonEmpty([row.middleChinese, row.oldChinese, row.dynasty, row.source]).joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !row.gloss.isEmpty {
                            Text(row.gloss)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }
            .padding(.top, 4)
        }
    }
}

struct CharacterHistoricalEvolutionView: View {
    var form: String
    var images: [CharacterImageReference]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Historical Evolution")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(images.prefix(12)) { image in
                        HistoricalFormCard(form: form, image: image)
                    }
                    HistoricalFormCard(form: form, label: "Regular", era: "Modern")
                }
                .padding(.vertical, 2)
            }
        }
        .accessibilityIdentifier("historicalEvolution.\(form)")
    }
}

struct HistoricalFormCard: View {
    var form: String
    var image: CharacterImageReference? = nil
    var label: String? = nil
    var era: String? = nil

    private var displayLabel: String {
        let value = label ?? image?.type ?? "Unknown"
        return value.isEmpty ? "Unknown" : value
    }

    private var displayEra: String {
        let value = era ?? image?.era ?? ""
        return value
    }

    var body: some View {
        VStack(spacing: 5) {
            historicalImage
                .frame(width: 58, height: 58)
            Text(displayLabel)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
            if !displayEra.isEmpty {
                Text(displayEra)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(width: 78)
        .padding(.vertical, 8)
        .padding(.horizontal, 6)
        .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityIdentifier(accessibilityIdentifier)
    }

    private var accessibilityIdentifier: String {
        if image?.strokeSet?.strokes.isEmpty == false {
            return "historicalStrokePreview.\(displayLabel)"
        }
        return "historicalForm.\(displayLabel)"
    }

    @ViewBuilder
    private var historicalImage: some View {
        if let strokeSet = image?.strokeSet, !strokeSet.strokes.isEmpty {
            ZStack {
                ForEach(Array(strokeSet.strokes.enumerated()), id: \.offset) { _, stroke in
                    HanziStrokeShape(pathData: stroke)
                        .fill(Color.primary)
                }
            }
            .padding(5)
            .frame(width: 58, height: 58)
            .background(.background, in: RoundedRectangle(cornerRadius: 8))
        } else if let url = image.flatMap({ URL(string: $0.url) }), ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image
                        .resizable()
                        .scaledToFit()
                } else {
                    fallbackGlyph
                }
            }
        } else {
            fallbackGlyph
        }
    }

    private var fallbackGlyph: some View {
        Text(form)
            .font(.system(size: 30, weight: .semibold, design: .serif))
            .frame(width: 58, height: 58)
            .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

struct CharacterCommentsView: View {
    var comments: [CharacterComment]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Comments")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ForEach(comments.prefix(10)) { comment in
                VStack(alignment: .leading, spacing: 4) {
                    if !comment.source.isEmpty {
                        Text(comment.source)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    Text(comment.comment)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(4)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityIdentifier("characterComment.\(comment.id)")
            }
        }
    }
}

struct SimilarCharactersSection: View {
    var similarCharacters: [SimilarCharacter]

    var body: some View {
        Section("Similar Characters") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(similarCharacters) { item in
                        NavigationLink(value: item.character) {
                            VStack(spacing: 4) {
                                Text(item.character)
                                    .font(.title2.weight(.semibold))
                                if !item.gloss.isEmpty {
                                    Text(item.gloss)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                if !item.sharedComponents.isEmpty {
                                    Text(item.sharedComponents.prefix(3).joined(separator: " "))
                                        .font(.caption2.weight(.medium))
                                        .foregroundStyle(.tertiary)
                                        .lineLimit(1)
                                }
                            }
                            .frame(width: 74)
                            .frame(minHeight: 64)
                            .padding(.vertical, 8)
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
}

struct PhoneticSeriesView: View {
    @EnvironmentObject private var model: AppModel
    let component: String
    @State private var draftComponent: String
    @State private var loadedComponent: String
    @State private var componentGloss = ""
    @State private var characters: [PhoneticSeriesCharacter] = []

    init(component: String) {
        self.component = component
        let normalized = Self.normalizedComponent(component)
        _draftComponent = State(initialValue: normalized)
        _loadedComponent = State(initialValue: normalized)
    }

    private var groupedCharacters: [(reading: String, characters: [PhoneticSeriesCharacter])] {
        var groups: [String: [PhoneticSeriesCharacter]] = [:]
        for character in characters {
            groups[character.primaryReading, default: []].append(character)
        }
        return groups
            .map { ($0.key, $0.value) }
            .sorted { lhs, rhs in
                if lhs.0 == "none" { return false }
                if rhs.0 == "none" { return true }
                if lhs.1.count != rhs.1.count { return lhs.1.count > rhs.1.count }
                return lhs.0.localizedStandardCompare(rhs.0) == .orderedAscending
            }
    }

    var body: some View {
        List {
            Section("Component") {
                HStack(spacing: 10) {
                    TextField("青", text: $draftComponent)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("phonetic.component")
                    Button {
                        loadCurrentComponent()
                    } label: {
                        Image(systemName: "magnifyingglass")
                    }
                    .accessibilityLabel("Load phonetic series")
                    .accessibilityIdentifier("phonetic.load")
                }
            }

            Section {
                VStack(alignment: .center, spacing: 8) {
                    Text(loadedComponent.isEmpty ? component : loadedComponent)
                        .font(.system(size: 56, weight: .semibold, design: .rounded))
                    if !componentGloss.isEmpty {
                        Text(componentGloss)
                            .font(.headline)
                            .foregroundStyle(.secondary)
                            .accessibilityIdentifier("phonetic.componentGloss")
                            .accessibilityLabel(componentGloss)
                    }
                    Text("Phonetic series · \(characters.count) \(characters.count == 1 ? "character" : "characters")")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .accessibilityIdentifier("phonetic.seriesCount")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            }

            if groupedCharacters.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No phonetic series",
                        systemImage: "point.3.connected.trianglepath.dotted",
                        description: Text("No sound-component characters are bundled for \(loadedComponent.isEmpty ? component : loadedComponent).")
                    )
                }
            } else {
                ForEach(groupedCharacters, id: \.reading) { group in
                    Section {
                        ForEach(group.characters) { item in
                            NavigationLink(value: item.character) {
                                PhoneticSeriesRow(item: item)
                            }
                            .accessibilityIdentifier("phonetic.char.\(item.character)")
                        }
                    } header: {
                        HStack {
                            Text(group.reading == "none" ? "No reading" : group.reading)
                            Text("\(group.characters.count)")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Phonetics")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(component)-\(model.db != nil)") {
            await loadWithRetry(component: loadedComponent)
        }
    }

    private func loadCurrentComponent() {
        let normalized = Self.normalizedComponent(draftComponent)
        guard !normalized.isEmpty else { return }
        loadedComponent = normalized
        draftComponent = normalized
        load(component: normalized)
    }

    private func load(component: String) {
        guard let db = model.db else { return }
        let normalized = Self.normalizedComponent(component)
        guard !normalized.isEmpty else { return }
        do {
            componentGloss = try db.phoneticComponentGloss(normalized)
            characters = try db.phoneticSeries(component: normalized)
        } catch {
            componentGloss = ""
            characters = []
            model.statusMessage = "Phonetic series unavailable: \(error.localizedDescription)"
        }
    }

    private func loadWithRetry(component: String) async {
        for attempt in 0..<4 {
            load(component: component)
            if !characters.isEmpty || Task.isCancelled {
                return
            }
            if attempt < 3 {
                try? await Task.sleep(nanoseconds: 350_000_000)
            }
        }
    }

    private static func normalizedComponent(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.first else { return "" }
        return String(first)
    }
}

struct PhoneticSeriesRow: View {
    var item: PhoneticSeriesCharacter

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(item.character)
                .font(.system(size: 34, weight: .semibold, design: .rounded))
                .frame(width: 44)
            VStack(alignment: .leading, spacing: 4) {
                if !item.pinyin.isEmpty {
                    Text(item.pinyin.joined(separator: ", "))
                        .font(.caption.monospaced())
                        .foregroundStyle(.tint)
                }
                if !item.gloss.isEmpty {
                    Text(item.gloss)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, 3)
    }
}

struct JapaneseNameSummaryView: View {
    var name: JapaneseNameSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(name.kanji.isEmpty ? name.kana.joined(separator: "、") : name.kanji.joined(separator: "、"))
                    .font(.headline)
                if !name.kana.isEmpty && !name.kanji.isEmpty {
                    Text(name.kana.joined(separator: "、"))
                        .foregroundStyle(.secondary)
                }
            }
            if !name.translations.isEmpty {
                Text(name.translations.joined(separator: ", "))
            }
            if !name.tags.isEmpty {
                FlowLayout(items: name.tags) { tag in
                    Text(tag)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.quaternary, in: Capsule())
                }
            }
        }
        .padding(.vertical, 3)
    }
}

struct EntryPreviewSection: View {
    var title: String
    var previews: [EntryPreview]

    var body: some View {
        Section(title) {
            ForEach(previews.prefix(24)) { preview in
                NavigationLink(value: preview.word) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(preview.word)
                                .font(.body.weight(.semibold))
                            if !preview.reading.isEmpty {
                                Text(preview.reading)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            if preview.isCommon {
                                Image(systemName: "star.fill")
                                    .font(.caption)
                                    .foregroundStyle(.yellow)
                            }
                            if let rank = preview.frequencyRank {
                                Text("#\(rank)")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(.quaternary, in: Capsule())
                            }
                        }
                        if !preview.definition.isEmpty {
                            Text(preview.definition)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }
            if previews.count > 24 {
                Text("+\(previews.count - 24) more")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct PitchAccentPatternView: View {
    var pattern: PitchAccentPattern

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            HStack(alignment: .center, spacing: 0) {
                ForEach(Array(pattern.morae.enumerated()), id: \.offset) { index, mora in
                    Text(mora)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 1)
                        .padding(.vertical, 2)
                        .overlay(alignment: .top) {
                            Rectangle()
                                .fill(pattern.isHighMora(at: index) ? Color.accentColor : Color.clear)
                                .frame(height: 2)
                        }
                        .overlay(alignment: .bottom) {
                            Rectangle()
                                .fill(pattern.isHighMora(at: index) ? Color.clear : Color.secondary.opacity(0.55))
                                .frame(height: 1)
                        }
                }
            }
            Text(pattern.label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pitch accent \(pattern.label), accent \(pattern.accent)")
        .accessibilityIdentifier("pitchAccent.\(pattern.word)")
    }
}

enum MetadataChipTone: Hashable {
    case neutral
    case misc
    case field
    case dialect

    func palette(colorScheme: ColorScheme) -> (foreground: Color, background: Color, border: Color) {
        switch (self, colorScheme) {
        case (.neutral, .dark):
            return (.secondary, Color(red: 0.10, green: 0.10, blue: 0.10), Color(red: 0.15, green: 0.15, blue: 0.15))
        case (.neutral, _):
            return (Color(red: 0.39, green: 0.45, blue: 0.55), Color(red: 0.95, green: 0.96, blue: 0.98), Color(red: 0.82, green: 0.84, blue: 0.86))
        case (.misc, .dark):
            return (Color(red: 0.43, green: 0.91, blue: 0.72), Color(red: 0.10, green: 0.10, blue: 0.10), Color(red: 0.20, green: 0.83, blue: 0.60))
        case (.misc, _):
            return (Color(red: 0.15, green: 0.39, blue: 0.92), Color(red: 0.94, green: 0.97, blue: 1.0), Color(red: 0.38, green: 0.65, blue: 0.98))
        case (.field, .dark):
            return (Color(red: 0.43, green: 0.91, blue: 0.72), Color(red: 0.10, green: 0.10, blue: 0.10), Color(red: 0.20, green: 0.83, blue: 0.60))
        case (.field, _):
            return (Color(red: 0.09, green: 0.64, blue: 0.29), Color(red: 0.94, green: 0.99, blue: 0.96), Color(red: 0.29, green: 0.87, blue: 0.50))
        case (.dialect, .dark):
            return (Color(red: 0.99, green: 0.65, blue: 0.65), Color(red: 0.10, green: 0.10, blue: 0.10), Color(red: 0.97, green: 0.44, blue: 0.44))
        case (.dialect, _):
            return (Color(red: 0.75, green: 0.09, blue: 0.36), Color(red: 0.99, green: 0.91, blue: 0.95), Color(red: 0.96, green: 0.45, blue: 0.71))
        }
    }
}

struct MetadataChipItem: Hashable {
    var text: String
    var tone: MetadataChipTone
}

struct MetadataChip: View {
    @Environment(\.colorScheme) private var colorScheme
    var text: String
    var systemImage: String? = nil
    var tone: MetadataChipTone = .neutral

    var body: some View {
        if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let colors = tone.palette(colorScheme: colorScheme)
            HStack(spacing: 4) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(text)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            .font(.caption.weight(.medium))
            .foregroundStyle(colors.foreground)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(colors.background, in: RoundedRectangle(cornerRadius: 5))
            .overlay {
                RoundedRectangle(cornerRadius: 5)
                    .stroke(colors.border, lineWidth: 1)
            }
        }
    }
}

struct ChineseWordEntryView: View {
    var entry: ChineseWordEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.displayHeadword.isEmpty ? entry.simplified : entry.displayHeadword)
                        .font(.title3.weight(.semibold))
                        .lineLimit(2)
                    if !entry.displayReading.isEmpty {
                        Text(entry.displayReading)
                            .font(.callout.monospaced())
                            .foregroundStyle(.tint)
                            .lineLimit(2)
                    }
                }
                Spacer()
                NativeSpeechButton(text: entry.simplified.isEmpty ? entry.traditional : entry.simplified, language: .zh)
            }

            ChineseDefinitionsView(definitions: displayDefinitions)

            if !supplementalLines.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(supplementalLines, id: \.self) { line in
                        Text(line)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, 2)
        .accessibilityIdentifier("chineseEntry.\(entry.displayHeadword)")
    }

    private var displayDefinitions: [String] {
        let itemDefinitions = uniqueNonEmpty(entry.items.flatMap(\.definitions))
        if !itemDefinitions.isEmpty {
            return itemDefinitions
        }
        return uniqueNonEmpty([entry.gloss])
    }

    private var supplementalLines: [String] {
        var lines: [String] = []
        let tang = uniqueNonEmpty(entry.items.flatMap(\.tang))
        if !tang.isEmpty {
            lines.append(tang.joined(separator: " / "))
        }
        let variants = uniqueNonEmpty(entry.items.flatMap(\.variantRefs))
        if !variants.isEmpty {
            lines.append("Variants: \(variants.joined(separator: ", "))")
        }
        return lines
    }
}

struct ChineseDefinitionsView: View {
    var definitions: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(Array(definitions.enumerated()), id: \.offset) { offset, definition in
                HStack(alignment: .top, spacing: 7) {
                    if definitions.count > 1 {
                        Text("\(offset + 1).")
                            .font(.callout.monospacedDigit().weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(minWidth: 20, alignment: .trailing)
                    }
                    Text(definition)
                        .font(.callout)
                        .textSelection(.enabled)
                }
            }
        }
    }
}

struct JapaneseWordEntryView: View {
    var entry: JapaneseWordEntry
    var labels: JapaneseLabelLookup
    var fallbackSection: WordSection

    private var conjugationTable: JapaneseConjugationTable? {
        JapaneseConjugator.table(for: fallbackSection)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            primaryReadingText
                            bracketedHeadwordText
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            primaryReadingText
                            bracketedHeadwordText
                        }
                    }
                    HStack(alignment: .center, spacing: 8) {
                        if entry.visibleKanji.contains(where: \.isCommon) || entry.visibleKana.contains(where: \.isCommon) {
                            MetadataChip(text: "Common", systemImage: "star.fill", tone: .field)
                        }
                        if let pitchAccent = fallbackSection.pitchAccent {
                            MetadataChip(text: pitchAccent.label)
                        }
                    }
                }
                Spacer()
                NativeSpeechButton(text: entry.speakText, language: .ja)
            }

            if !headwordInfoTags.isEmpty {
                FlowLayout(items: headwordInfoTags) { tag in
                    MetadataChip(text: tag, tone: .misc)
                }
            }

            JapaneseDefinitionsView(senses: entry.senses, labels: labels)

            if !entry.flattenedExamples.isEmpty {
                DisclosureGroup("Examples (\(entry.flattenedExamples.count))") {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(entry.flattenedExamples.prefix(8)) { example in
                            SentenceExampleRow(example: example, language: .ja)
                        }
                    }
                    .padding(.top, 4)
                }
            }

            if let conjugationTable {
                JapaneseConjugationTableView(table: conjugationTable)
            }
        }
        .padding(.vertical, 2)
        .accessibilityIdentifier("japaneseEntry.\(entry.displayHeadword)")
    }

    private var primaryReadingText: some View {
        Text(primaryDisplayReading)
            .font(.title3.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }

    private var bracketedHeadwordText: some View {
        Group {
            if !entry.displayReading.isEmpty && entry.displayReading != entry.displayHeadword {
                Text("[\(entry.displayHeadword)]")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
    }

    private var primaryDisplayReading: String {
        if !entry.displayReading.isEmpty {
            return entry.displayReading
        }
        return entry.displayHeadword
    }

    private var headwordInfoTags: [String] {
        let headwords = entry.visibleKanji + entry.visibleKana
        return uniqueNonEmpty(headwords.flatMap { headword in
            headword.tags.map { labels.headwordInfoLabel($0) }
        })
    }

}

struct JapaneseDefinitionsView: View {
    var senses: [JapaneseSenseSummary]
    var labels: JapaneseLabelLookup

    var body: some View {
        let sharedChips = commonTagChips
        VStack(alignment: .leading, spacing: 6) {
            if !sharedChips.isEmpty {
                FlowLayout(items: sharedChips) { chip in
                    MetadataChip(text: chip.text, tone: chip.tone)
                }
            }

            if senses.count == 1, let sense = senses.first {
                JapaneseSenseRow(index: nil, sense: sense, labels: labels, showPartOfSpeech: true, hiddenChips: Set(sharedChips))
            } else {
                ForEach(Array(senses.enumerated()), id: \.element.id) { offset, sense in
                    JapaneseSenseRow(index: offset + 1, sense: sense, labels: labels, showPartOfSpeech: true, hiddenChips: Set(sharedChips))
                }
            }
        }
    }

    private var commonTagChips: [MetadataChipItem] {
        guard !senses.isEmpty else { return [] }
        let chipRows = senses.map { JapaneseSenseRow.tagChips(for: $0, labels: labels, showPartOfSpeech: true) }
        guard let first = chipRows.first else { return [] }
        return first.filter { chip in
            chipRows.allSatisfy { $0.contains(chip) }
        }
    }
}

struct JapaneseSenseRow: View {
    var index: Int?
    var sense: JapaneseSenseSummary
    var labels: JapaneseLabelLookup
    var showPartOfSpeech: Bool
    var hiddenChips: Set<MetadataChipItem> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !visibleTagChips.isEmpty {
                FlowLayout(items: visibleTagChips) { chip in
                    MetadataChip(text: chip.text, tone: chip.tone)
                }
            }

            HStack(alignment: .top, spacing: 7) {
                if let index {
                    Text("\(index).")
                        .font(.callout.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(glossText)
                        .font(.callout)
                    if !sense.info.isEmpty {
                        Text(sense.info.joined(separator: "; "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if !scopeText.isEmpty {
                        Text(scopeText)
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    if !relationText.isEmpty {
                        Text(relationText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if !sourceText.isEmpty {
                        Text(sourceText)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var visibleTagChips: [MetadataChipItem] {
        tagChips.filter { !hiddenChips.contains($0) }
    }

    private var tagChips: [MetadataChipItem] {
        Self.tagChips(for: sense, labels: labels, showPartOfSpeech: showPartOfSpeech)
    }

    static func tagChips(for sense: JapaneseSenseSummary, labels: JapaneseLabelLookup, showPartOfSpeech: Bool) -> [MetadataChipItem] {
        var values: [MetadataChipItem] = []
        if showPartOfSpeech {
            values.append(contentsOf: sense.partOfSpeech.map {
                MetadataChipItem(text: labels.label($0, category: .partOfSpeech), tone: .neutral)
            })
        }
        values.append(contentsOf: sense.field.map {
            MetadataChipItem(text: labels.label($0, category: .field), tone: .field)
        })
        values.append(contentsOf: sense.misc.map {
            MetadataChipItem(text: labels.label($0, category: .misc), tone: .misc)
        })
        values.append(contentsOf: sense.dialect.map {
            MetadataChipItem(text: labels.label($0, category: .dialect), tone: .dialect)
        })
        var seen = Set<String>()
        return values.filter { chip in
            let normalized = chip.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else { return false }
            return seen.insert("\(normalized)|\(chip.tone)").inserted
        }
    }

    private var glossText: String {
        let values = sense.glosses.map { gloss -> String in
            let type = gloss.type.isEmpty || gloss.type == "none" ? "" : "(\(labels.label(gloss.type, category: .glossType))) "
            return "\(type)\(gloss.text)"
        }
        return values.isEmpty ? "No English gloss in local record" : values.joined(separator: "; ")
    }

    private var scopeText: String {
        var values: [String] = []
        let kanjiScope = meaningfulScopeValues(sense.appliesToKanji)
        let kanaScope = meaningfulScopeValues(sense.appliesToKana)
        if !kanjiScope.isEmpty {
            values.append("Only written as \(kanjiScope.joined(separator: ", "))")
        }
        if !kanaScope.isEmpty {
            values.append("Only read as \(kanaScope.joined(separator: ", "))")
        }
        return values.joined(separator: " · ")
    }

    private func meaningfulScopeValues(_ values: [String]) -> [String] {
        values
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && $0 != "*" && $0 != "＊" }
    }

    private var relationText: String {
        var values: [String] = []
        if !sense.related.isEmpty {
            values.append("Related: \(sense.related.map(\.text).joined(separator: ", "))")
        }
        if !sense.antonyms.isEmpty {
            values.append("Antonyms: \(sense.antonyms.map(\.text).joined(separator: ", "))")
        }
        return values.joined(separator: " · ")
    }

    private var sourceText: String {
        let values = sense.languageSource.map { source -> String in
            var parts = [source.lang, source.text].filter { !$0.isEmpty }
            if source.isFull { parts.append("full") }
            if source.isWasei { parts.append("wasei") }
            return parts.joined(separator: " ")
        }
        return values.joined(separator: " · ")
    }
}

struct KoreanWordEntryView: View {
    var entry: KoreanWordEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.displayHeadword)
                        .font(.title3.weight(.semibold))
                        .lineLimit(2)
                    if !entry.displayReading.isEmpty {
                        Text(entry.displayReading)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                Spacer()
                NativeSpeechButton(text: entry.hangul, language: .ko)
            }

            if !tagLabels.isEmpty {
                FlowLayout(items: tagLabels) { tag in
                    MetadataChip(text: tag)
                }
            }

            if !entry.definitions.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(Array(entry.definitions.indices), id: \.self) { index in
                        let definition = entry.definitions[index]
                        HStack(alignment: .top, spacing: 7) {
                            Text("\(index + 1).")
                                .font(.callout.monospacedDigit().weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(definition.text)
                                .font(.callout)
                                .textSelection(.enabled)
                        }
                    }
                }
            }

            if !entry.examples.isEmpty {
                DisclosureGroup("Examples (\(entry.examples.count))") {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(entry.examples.prefix(8)) { example in
                            SentenceExampleRow(
                                example: SentenceExample(language: .ko, text: example.korean, translation: example.translation, source: ""),
                                language: .ko
                            )
                        }
                    }
                    .padding(.top, 4)
                }
            }
        }
        .padding(.vertical, 2)
        .accessibilityIdentifier("koreanEntry.\(entry.displayHeadword)")
    }

    private var tagLabels: [String] {
        var tags = [entry.partOfSpeech, entry.origin]
        if let rank = entry.frequencyRank {
            tags.append("rank \(rank)")
        }
        return uniqueNonEmpty(tags)
    }
}

struct SentenceExampleRow: View {
    var example: SentenceExample
    var language: LanguageCode

    var body: some View {
        NavigationLink {
            SentenceReaderView(
                initialSentence: example.text,
                initialTranslation: example.translation,
                initialLanguage: example.language
            )
        } label: {
            content
        }
        .accessibilityIdentifier("sentenceExample.open.\(example.language.rawValue).\(example.text)")
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(example.text)
                    .font(.body)
                    .textSelection(.enabled)
                Spacer()
                NativeSpeechButton(text: example.text, language: language)
            }
            if !example.translation.isEmpty {
                Text(example.translation)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if !example.source.isEmpty {
                Text(example.source)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 3)
    }
}

struct WordSectionView: View {
    var section: WordSection
    private var conjugationTable: JapaneseConjugationTable? {
        JapaneseConjugator.table(for: section)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(section.headword)
                        .font(.title3.weight(.semibold))
                        .lineLimit(2)
                    if !section.reading.isEmpty {
                        Text(section.reading)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    if let pitchAccent = section.pitchAccent {
                        PitchAccentPatternView(pattern: pitchAccent)
                    }
                }
                Spacer()
                NativeSpeechButton(text: section.headword, language: section.language)
            }
            if !section.tags.isEmpty {
                FlowLayout(items: section.tags) { tag in
                    MetadataChip(text: tag)
                }
            }
            if !section.definitions.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(Array(section.definitions.indices), id: \.self) { index in
                        let definition = section.definitions[index]
                        HStack(alignment: .top, spacing: 7) {
                            if section.definitions.count > 1 {
                                Text("\(index + 1).")
                                    .font(.callout.monospacedDigit().weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            Text(definition)
                                .font(.callout)
                                .textSelection(.enabled)
                        }
                    }
                }
            }
            if !section.examples.isEmpty {
                DisclosureGroup("Examples (\(section.examples.count))") {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(section.examples.prefix(6)) { example in
                            SentenceExampleRow(example: example, language: section.language)
                        }
                    }
                }
            }
            if let conjugationTable {
                JapaneseConjugationTableView(table: conjugationTable)
            }
        }
        .padding(.vertical, 2)
    }
}

struct JapaneseConjugationTableView: View {
    var table: JapaneseConjugationTable

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Label("Conjugation", systemImage: "tablecells")
                    .font(.callout.weight(.semibold))
                Text(table.verbType.displayLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("conjugation.verbType")
            }

            ForEach(JapaneseConjugationTable.categoryOrder, id: \.self) { category in
                let forms = table.forms(in: category)
                if !forms.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(JapaneseConjugationTable.categoryTitle(category))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        VStack(spacing: 0) {
                            ForEach(forms) { form in
                                HStack(alignment: .firstTextBaseline, spacing: 10) {
                                    Text(form.label)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .frame(width: 112, alignment: .trailing)
                                    Text(form.form)
                                        .font(.callout)
                                        .textSelection(.enabled)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .accessibilityIdentifier("conjugation.form.\(form.label)")
                                }
                                .padding(.vertical, 3)
                                if form.id != forms.last?.id {
                                    Divider()
                                }
                            }
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
        }
        .accessibilityIdentifier("conjugation.table")
    }
}

struct StaticSentenceExamplesSection: View {
    var examples: [StaticSentenceExample]
    @State private var expanded = false
    @State private var showTraditional = false

    private var displayedExamples: [StaticSentenceExample] {
        expanded ? examples : Array(examples.prefix(6))
    }

    private var hasTraditionalChinese: Bool {
        examples.contains { $0.language == .zh && !$0.alternateText.isEmpty && $0.alternateText != $0.text }
    }

    var body: some View {
        Section {
            if hasTraditionalChinese {
                Toggle(isOn: $showTraditional) {
                    Label(showTraditional ? "Traditional" : "Simplified", systemImage: "character.book.closed")
                }
                .accessibilityIdentifier("staticExamples.scriptToggle")
            }

            ForEach(displayedExamples) { example in
                NavigationLink {
                    SentenceReaderView(
                        initialSentence: displayText(for: example),
                        initialTranslation: example.translation,
                        initialLanguage: example.language
                    )
                } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(displayText(for: example))
                            .font(.body)
                            .textSelection(.enabled)
                            .accessibilityIdentifier("staticExamples.row.\(example.language.rawValue)")
                        if !example.reading.isEmpty {
                            Text(example.reading)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if !example.translation.isEmpty {
                            Text(example.translation)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        HStack(spacing: 6) {
                            Text(example.language.title)
                            if !example.source.isEmpty {
                                Text(example.source)
                            }
                        }
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    }
                }
                .padding(.vertical, 4)
                .accessibilityIdentifier("staticExamples.open.\(example.language.rawValue).\(example.text)")
            }

            if examples.count > displayedExamples.count {
                Button {
                    expanded = true
                } label: {
                    Label("Show \(examples.count - displayedExamples.count) more", systemImage: "chevron.down")
                }
            } else if expanded && examples.count > 6 {
                Button {
                    expanded = false
                } label: {
                    Label("Show less", systemImage: "chevron.up")
                }
            }
        } header: {
            Text("Sentence Examples")
        } footer: {
            Text("Loaded from compressed local sentence shards.")
        }
    }

    private func displayText(for example: StaticSentenceExample) -> String {
        if showTraditional, example.language == .zh, !example.alternateText.isEmpty {
            return example.alternateText
        }
        return example.text
    }
}

struct NativeSentenceToken: Identifiable, Hashable {
    var id: Int
    var text: String
    var lookupText: String
    var reading: String
    var isWord: Bool
}

enum NativeSentenceTokenizer {
    static func tokenize(_ text: String, language: LanguageCode, db: LocalDatabase?) -> [NativeSentenceToken] {
        var tokens: [NativeSentenceToken] = []
        var run = ""
        var runIsWord = false
        var lookupCache = LookupCache()

        func flushRun() {
            guard !run.isEmpty else { return }
            if runIsWord {
                tokens.append(contentsOf: segmentWordRun(run, language: language, db: db, startingAt: tokens.count, cache: &lookupCache))
            } else {
                tokens.append(NativeSentenceToken(id: tokens.count, text: run, lookupText: "", reading: "", isWord: false))
            }
            run = ""
        }

        for character in text {
            let wordLike = isWordLike(character, language: language)
            if run.isEmpty {
                run = String(character)
                runIsWord = wordLike
            } else if wordLike == runIsWord {
                run.append(character)
            } else {
                flushRun()
                run = String(character)
                runIsWord = wordLike
            }
        }
        flushRun()

        return tokens
    }

    private struct LookupSummary {
        var reading: String
    }

    private struct LookupCache {
        var found: [String: LookupSummary] = [:]
        var missing = Set<String>()
    }

    private static func segmentWordRun(_ run: String, language: LanguageCode, db: LocalDatabase?, startingAt offset: Int, cache: inout LookupCache) -> [NativeSentenceToken] {
        let characters = Array(run)
        var output: [NativeSentenceToken] = []
        var index = characters.startIndex
        while index < characters.endIndex {
            let maxLength = min(8, characters.endIndex - index)
            var selectedText = String(characters[index])
            var selectedReading = ""
            for length in stride(from: maxLength, through: 1, by: -1) {
                let candidate = String(characters[index..<(index + length)])
                if let lookup = cachedLookup(candidate, language: language, db: db, cache: &cache) {
                    selectedText = candidate
                    selectedReading = lookup.reading
                    break
                }
            }
            output.append(NativeSentenceToken(
                id: offset + output.count,
                text: selectedText,
                lookupText: selectedText,
                reading: selectedReading,
                isWord: true
            ))
            index += selectedText.count
        }
        return output
    }

    private static func cachedLookup(_ candidate: String, language: LanguageCode, db: LocalDatabase?, cache: inout LookupCache) -> LookupSummary? {
        if let cached = cache.found[candidate] {
            return cached
        }
        if cache.missing.contains(candidate) {
            return nil
        }
        guard let lookup = try? db?.lookupResolved(word: candidate) else {
            cache.missing.insert(candidate)
            return nil
        }
        let summary = LookupSummary(
            reading: preferredReading(for: lookup.record, language: language)
        )
        cache.found[candidate] = summary
        return summary
    }

    private static func preferredReading(for record: DictionaryRecord, language: LanguageCode) -> String {
        let preferred = record.allSections.first { $0.language == language && !$0.reading.isEmpty }
        if let preferred {
            return preferred.reading
        }
        return record.allSections.first(where: { !$0.reading.isEmpty })?.reading ?? ""
    }

    private static func isWordLike(_ character: Character, language: LanguageCode) -> Bool {
        guard let scalar = character.unicodeScalars.first else { return false }
        let value = scalar.value
        if value >= 0x4E00 && value <= 0x9FFF { return true }
        if value >= 0x3400 && value <= 0x4DBF { return true }
        if value >= 0x3040 && value <= 0x30FF { return language == .ja }
        if value >= 0xAC00 && value <= 0xD7AF { return language == .ko }
        if value >= 0x1100 && value <= 0x11FF { return language == .ko }
        return CharacterSet.alphanumerics.contains(scalar)
    }
}

struct SentenceReaderView: View {
    @EnvironmentObject private var model: AppModel
    @State private var sentence: String
    @State private var translation: String
    @State private var language: LanguageCode
    @State private var tokens: [NativeSentenceToken] = []
    @State private var tokenizationTask: Task<Void, Never>?
    @FocusState private var focusedInput: SentenceReaderInput?

    private enum SentenceReaderInput: Hashable {
        case sentence
        case translation
    }

    init(initialSentence: String = "", initialTranslation: String = "", initialLanguage: LanguageCode = .ja) {
        _sentence = State(initialValue: initialSentence)
        _translation = State(initialValue: initialTranslation)
        _language = State(initialValue: initialLanguage)
    }

    private func dismissKeyboard() {
        focusedInput = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    var body: some View {
        List {
            Section("Input") {
                Picker("Language", selection: $language) {
                    Text("Japanese").tag(LanguageCode.ja)
                    Text("Chinese").tag(LanguageCode.zh)
                    Text("Korean").tag(LanguageCode.ko)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("sentenceReader.language")

                TextField("Sentence", text: $sentence, axis: .vertical)
                    .lineLimit(2...5)
                    .focused($focusedInput, equals: .sentence)
                    .accessibilityIdentifier("sentenceReader.input")

                TextField("Translation", text: $translation, axis: .vertical)
                    .lineLimit(1...3)
                    .focused($focusedInput, equals: .translation)
                    .accessibilityIdentifier("sentenceReader.translation")
            }

            Section {
                if sentence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    ContentUnavailableView("No sentence", systemImage: "text.viewfinder", description: Text("Paste or open an example sentence to read it offline."))
                } else {
                    ForEach(tokens) { token in
                        if token.isWord {
                            NavigationLink(value: token) {
                                SentenceTokenRow(token: token)
                            }
                            .accessibilityIdentifier("sentenceReader.token.\(token.lookupText)")
                        } else {
                            Text(token.text)
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if !translation.isEmpty {
                        Text(translation)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .accessibilityIdentifier("sentenceReader.translationText")
                    }
                }
            } header: {
                Text("Reader")
            } footer: {
                Text("Tap a token to look it up from the local dictionary.")
            }
        }
        .navigationTitle("Sentence Reader")
        .navigationDestination(for: NativeSentenceToken.self) { token in
            SentenceLookupPanel(token: token, language: language)
                .environmentObject(model)
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    dismissKeyboard()
                }
                .accessibilityIdentifier("sentenceReader.keyboardDone")
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .onAppear {
            scheduleTokenization(immediate: true)
        }
        .onDisappear {
            tokenizationTask?.cancel()
        }
        .onChange(of: sentence) { _, _ in
            scheduleTokenization()
        }
        .onChange(of: language) { _, _ in
            scheduleTokenization(immediate: true)
        }
        .onChange(of: model.db != nil) { _, _ in
            scheduleTokenization(immediate: true)
        }
    }

    private func scheduleTokenization(immediate: Bool = false) {
        tokenizationTask?.cancel()
        let sentence = sentence
        let language = language
        let db = model.db
        tokenizationTask = Task {
            if !immediate {
                try? await Task.sleep(nanoseconds: 120_000_000)
            }
            guard !Task.isCancelled else { return }
            let next = NativeSentenceTokenizer.tokenize(sentence, language: language, db: db)
            guard !Task.isCancelled else { return }
            tokens = next
        }
    }
}

struct SentenceTokenRow: View {
    var token: NativeSentenceToken

    var body: some View {
        HStack(spacing: 12) {
            Text(token.text)
                .font(.title2.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(minWidth: 58, alignment: .leading)
            Spacer(minLength: 12)
            VStack(alignment: .trailing, spacing: 3) {
                if !token.reading.isEmpty {
                    Text(token.reading)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if token.lookupText != token.text {
                    Text(token.lookupText)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            Image(systemName: "magnifyingglass")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 7)
    }
}

struct SentenceTokenChip: View {
    var token: NativeSentenceToken

    var body: some View {
        VStack(spacing: 2) {
            if !token.reading.isEmpty {
                Text(token.reading)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Text(token.text)
                .font(.title3.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(minWidth: 72, minHeight: token.reading.isEmpty ? 42 : 52)
        .padding(.horizontal, 8)
        .background(.quaternary.opacity(0.65), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct SentenceLookupPanel: View {
    @EnvironmentObject private var model: AppModel
    var token: NativeSentenceToken
    var language: LanguageCode

    private var resolved: ResolvedDictionaryLookup? {
        model.lookupResolved(token.lookupText)
    }

    var body: some View {
        List {
            Section {
                HStack(alignment: .firstTextBaseline) {
                    Text(resolved?.record.key ?? token.lookupText)
                        .font(.largeTitle.weight(.semibold))
                    Spacer()
                    NativeSpeechButton(text: token.lookupText, language: language)
                }
                if let inflection = resolved?.inflection {
                    Label("\(inflection.original) → \(inflection.dictionaryForm) (\(inflection.conjugationInfo))", systemImage: "arrow.triangle.branch")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("sentenceReader.deinflection")
                }
            }

            if let record = resolved?.record {
                ForEach(record.allSections.prefix(4)) { section in
                    Section(section.language.title) {
                        if !section.reading.isEmpty {
                            Text(section.reading)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(section.definitions.prefix(5), id: \.self) { definition in
                            Text(definition)
                        }
                    }
                }
                Section {
                    NavigationLink {
                        DictionaryDetailView(word: record.key)
                    } label: {
                        Label("Open full entry", systemImage: "arrow.right.circle")
                    }
                    .accessibilityIdentifier("sentenceReader.openEntry")
                }
            } else {
                ContentUnavailableView("No local entry", systemImage: "magnifyingglass", description: Text("This token is not in the bundled dictionary."))
            }
        }
        .navigationTitle(token.lookupText)
        .toolbar {
            if let record = resolved?.record {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        DictionaryDetailView(word: record.key)
                    } label: {
                        Label("Open full entry", systemImage: "arrow.right.circle")
                    }
                    .accessibilityIdentifier("sentenceReader.openEntry")
                }
            }
        }
        .accessibilityIdentifier("sentenceReader.lookupPanel")
    }
}

struct StudyView: View {
    @EnvironmentObject private var model: AppModel
    @State private var mode: StudyMode = .review

    enum StudyMode: String, CaseIterable, Identifiable {
        case review = "Review"
        case cards = "Cards"
        case stats = "Stats"
        var id: String { rawValue }
    }

    var dueCards: [StudyCard] {
        model.studyCards.filter(\.isDue)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Mode", selection: $mode) {
                        ForEach(StudyMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                switch mode {
                case .review:
                    if let card = dueCards.first {
                        Section("Due Now") {
                            StudyReviewCard(card: card)
                        }
                    } else {
                        ContentUnavailableView("No cards due", systemImage: "checkmark.seal", description: Text("New cards and due reviews will appear here."))
                    }
                case .cards:
                    Section("All Cards") {
                        ForEach(model.studyCards) { card in
                            StudyCardRow(card: card)
                                .swipeActions {
                                    Button(role: .destructive) { model.delete(card: card) } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                    Button { model.reset(card: card) } label: {
                                        Label("Reset", systemImage: "arrow.counterclockwise")
                                    }
                                }
                        }
                    }
                case .stats:
                    StudyStatsView(stats: model.studyStats)
                }
            }
            .navigationTitle("Study")
        }
    }
}

struct StudyReviewCard: View {
    @EnvironmentObject private var model: AppModel
    var card: StudyCard
    @State private var showingAnswer = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(card.word)
                    .font(.system(size: 48, weight: .semibold, design: .rounded))
                    .textSelection(.enabled)
                Spacer(minLength: 8)
                NativeSpeechButton(text: card.word, language: card.language)
            }
            HStack(spacing: 8) {
                Text(card.language.title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if showingAnswer {
                    NativeSpeechButton(text: card.word, language: card.language, label: "Listen again")
                        .font(.caption)
                }
            }

            if showingAnswer {
                if let record = model.lookup(card.word) {
                    ForEach(record.allSections.prefix(2)) { section in
                        WordSectionView(section: section)
                    }
                }
                HStack {
                    ForEach(ReviewRating.allCases) { rating in
                        Button(rating.title) {
                            model.review(card: card, rating: rating)
                            showingAnswer = false
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .buttonStyle(.bordered)
            } else {
                Button {
                    showingAnswer = true
                } label: {
                    Label("Show answer", systemImage: "eye")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(.vertical, 8)
    }
}

struct StudyCardRow: View {
    var card: StudyCard

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(card.word)
                    .font(.headline)
                    .textSelection(.enabled)
                NativeSpeechButton(text: card.word, language: card.language)
                Spacer()
                Text(card.language.title).font(.caption).foregroundStyle(.secondary)
            }
            Text("Interval \(card.interval) days · EF \(Double(card.easeFactor) / 100, specifier: "%.2f") · reps \(card.repetitions)")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("Next: \(card.nextReview.formatted(date: .abbreviated, time: .omitted))")
                .font(.caption)
                .foregroundStyle(card.isDue ? .red : .secondary)
        }
    }
}

struct StudyStatsView: View {
    var stats: StudyStats

    var body: some View {
        Section("Overview") {
            StatRow(title: "Total cards", value: "\(stats.totalCards)")
            StatRow(title: "Due today", value: "\(stats.dueToday)")
            StatRow(title: "Due this week", value: "\(stats.dueThisWeek)")
            StatRow(title: "New", value: "\(stats.cardsNew)")
            StatRow(title: "Learning", value: "\(stats.cardsLearning)")
            StatRow(title: "Mature", value: "\(stats.cardsMature)")
            StatRow(title: "Average ease", value: String(format: "%.2f", stats.averageEase))
        }
    }
}

struct StatRow: View {
    var title: String
    var value: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text(value).foregroundStyle(.secondary)
        }
    }
}

struct ListsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var query = ""
    @State private var showingCustomWordEditor = false

    var filteredNotes: [UserNote] {
        guard !query.isEmpty else { return model.notes }
        return model.notes.filter { $0.character.localizedStandardContains(query) || $0.noteText.localizedStandardContains(query) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Notes") {
                    ForEach(filteredNotes) { note in
                        NavigationLink(value: note.character) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(note.character).font(.title3.weight(.semibold))
                                Text(note.noteText).lineLimit(2).foregroundStyle(.secondary)
                                Text(note.updatedAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .swipeActions {
                            Button(role: .destructive) { model.deleteNote(note) } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }

                Section("Custom Words") {
                    ForEach(model.customWords) { word in
                        NavigationLink(value: word.word) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(word.word).font(.headline)
                                if !word.reading.isEmpty {
                                    Text(word.reading).foregroundStyle(.secondary)
                                }
                                Text(word.definitions.joined(separator: "; "))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Lists")
            .navigationDestination(for: String.self) { word in
                DictionaryDetailView(word: word)
            }
            .searchable(text: $query, prompt: "Search notes")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCustomWordEditor = true
                    } label: {
                        Image(systemName: "plus.circle")
                    }
                    .accessibilityLabel("Add custom word")
                    .accessibilityIdentifier("customWord.add")
                }
            }
            .sheet(isPresented: $showingCustomWordEditor) {
                NavigationStack {
                    CustomWordEditor()
                }
            }
        }
    }
}

struct CustomWordEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var draft = CustomWordDraft()

    var body: some View {
        Form {
            Section("Word") {
                TextField("Word", text: $draft.word)
                    .accessibilityIdentifier("customWord.word")
                Picker("Language", selection: $draft.language) {
                    ForEach(LanguageCode.allCases) { language in
                        Text(language.title).tag(language)
                    }
                }
                TextField("Reading", text: $draft.reading)
                    .accessibilityIdentifier("customWord.reading")
            }
            Section("Definitions") {
                TextEditor(text: $draft.definitions)
                    .frame(minHeight: 120)
                    .accessibilityIdentifier("customWord.definitions")
            }
            Section("Notes") {
                TextEditor(text: $draft.notes)
                    .frame(minHeight: 100)
                    .accessibilityIdentifier("customWord.notes")
            }
        }
        .accessibilityIdentifier("customWord.form")
        .navigationTitle("Custom Word")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    model.save(customWord: draft)
                    dismiss()
                }
                .disabled(draft.word.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.definitions.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("customWord.save")
            }
        }
    }
}

struct ArtifactsView: View {
    var body: some View {
        NavigationStack {
            ArtifactsContentView()
        }
    }
}

struct ArtifactsContentView: View {
    @EnvironmentObject private var model: AppModel
    @State private var showingEditor = false

    var body: some View {
        List {
            ForEach(model.artifacts) { artifact in
                NavigationLink {
                    ArtifactDetailView(artifact: artifact)
                } label: {
                    ArtifactRow(artifact: artifact)
                }
                .accessibilityIdentifier("artifact.row.\(artifact.title)")
            }
        }
        .accessibilityIdentifier("artifacts.list")
        .navigationTitle("Artifacts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingEditor = true
                } label: {
                    Image(systemName: "plus.circle")
                }
                .accessibilityLabel("Add artifact")
                .accessibilityIdentifier("artifact.add")
            }
        }
        .sheet(isPresented: $showingEditor) {
            NavigationStack {
                ArtifactEditor()
            }
        }
    }
}

struct ArtifactRow: View {
    var artifact: Artifact

    var body: some View {
        HStack(spacing: 12) {
            if let path = artifact.thumbnailPath {
                ArtifactThumbnail(path: path)
            } else {
                ArtifactThumbnailPlaceholder()
            }
            VStack(alignment: .leading, spacing: 5) {
                Text(artifact.title).font(.headline)
                Text(artifact.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                Text("\(artifact.language.title) · \(artifact.type) · \(artifact.sentenceCount) sentences")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

struct ArtifactThumbnail: View {
    var path: String

    var body: some View {
        if let image = UIImage(contentsOfFile: path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        } else if let url = remoteURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    ArtifactThumbnailPlaceholder()
                }
            }
            .frame(width: 56, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        } else {
            ArtifactThumbnailPlaceholder()
        }
    }

    private var remoteURL: URL? {
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            return URL(string: path)
        }
        guard path.hasPrefix("/api/"),
              let raw = UserDefaults.standard.string(forKey: "cloudflareBaseURL"),
              let baseURL = URL(string: raw)
        else { return nil }
        return URL(string: path, relativeTo: baseURL)?.absoluteURL
    }
}

struct ArtifactThumbnailPlaceholder: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(.quaternary)
            .frame(width: 56, height: 56)
            .overlay(Image(systemName: "photo").foregroundStyle(.secondary))
    }
}

struct ArtifactImagePreview: View {
    var image: ArtifactImage

    var body: some View {
        Group {
            if let uiImage = UIImage(contentsOfFile: image.imagePath) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else if let url = remoteURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: 120, height: 120)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.secondary.opacity(0.25), lineWidth: 1)
        }
        .accessibilityLabel("Artifact image")
        .accessibilityIdentifier("artifactImage.\(image.id)")
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(.quaternary)
            .overlay(Image(systemName: "photo").foregroundStyle(.secondary))
    }

    private var remoteURL: URL? {
        if image.imagePath.hasPrefix("http://") || image.imagePath.hasPrefix("https://") {
            return URL(string: image.imagePath)
        }
        guard image.imagePath.hasPrefix("/api/"),
              let raw = UserDefaults.standard.string(forKey: "cloudflareBaseURL"),
              let baseURL = URL(string: raw)
        else { return nil }
        return URL(string: image.imagePath, relativeTo: baseURL)?.absoluteURL
    }
}

struct ArtifactEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ArtifactDraft()

    var body: some View {
        Form {
            Section("Artifact") {
                TextField("Title", text: $draft.title)
                    .accessibilityIdentifier("artifact.title")
                TextField("Description", text: $draft.description, axis: .vertical)
                    .accessibilityIdentifier("artifact.description")
                Picker("Language", selection: $draft.language) {
                    ForEach(LanguageCode.allCases) { language in
                        Text(language.title).tag(language)
                    }
                }
                Picker("Type", selection: $draft.type) {
                    ForEach(["packaging", "sign", "menu", "book", "media", "other"], id: \.self) {
                        Text($0.capitalized).tag($0)
                    }
                }
                Toggle("Public after sync", isOn: $draft.isPublic)
            }
        }
        .accessibilityIdentifier("artifact.form")
        .navigationTitle("New Artifact")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    model.createArtifact(draft)
                    dismiss()
                }
                .disabled(draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("artifact.save")
            }
        }
    }
}

struct ArtifactDetailView: View {
    @EnvironmentObject private var model: AppModel
    var artifact: Artifact
    @State private var original = ""
    @State private var translation = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var sentences: [ArtifactSentence] = []
    @State private var images: [ArtifactImage] = []

    var body: some View {
        List {
            Section {
                ArtifactRow(artifact: artifact)
            }

            Section("Add Photo") {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label("Attach image", systemImage: "photo.badge.plus")
                }
                .accessibilityIdentifier("artifactImage.attach")

                if isUITestImageInjectionEnabled {
                    Button {
                        addUITestImage()
                    } label: {
                        Label("Attach UI test image", systemImage: "testtube.2")
                    }
                    .accessibilityIdentifier("artifactImage.injectUITest")
                }
            }

            Section("Images") {
                if images.isEmpty {
                    ContentUnavailableView("No images", systemImage: "photo")
                } else {
                    ScrollView(.horizontal) {
                        LazyHStack(spacing: 12) {
                            ForEach(images) { image in
                                ArtifactImagePreview(image: image)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .scrollIndicators(.hidden)
                    .frame(height: 132)
                    .accessibilityIdentifier("artifactImage.gallery")
                }
            }

            Section("Add Sentence") {
                TextField("Original text", text: $original, axis: .vertical)
                    .accessibilityIdentifier("artifactSentence.original")
                TextField("Translation", text: $translation, axis: .vertical)
                    .accessibilityIdentifier("artifactSentence.translation")
                Button {
                    model.addSentence(to: artifact, original: original, translation: translation)
                    original = ""
                    translation = ""
                    loadSentences()
                } label: {
                    Label("Save sentence", systemImage: "text.badge.plus")
                }
                .disabled(original.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("artifactSentence.save")
            }

            Section("Sentences") {
                ForEach(sentences) { sentence in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(sentence.originalText)
                            .font(.headline)
                            .accessibilityIdentifier("artifactSentence.row.\(sentence.originalText)")
                        if !sentence.translation.isEmpty {
                            Text(sentence.translation)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(artifact.title)
        .onAppear {
            loadImages()
            loadSentences()
        }
        .onChange(of: photoItem) { _, item in
            Task {
                guard let data = try? await item?.loadTransferable(type: Data.self) else { return }
                await MainActor.run {
                    model.addImage(to: artifact, data: data)
                    loadImages()
                    photoItem = nil
                }
            }
        }
    }

    private func loadImages() {
        guard let db = model.db else { return }
        images = (try? db.listArtifactImages(artifactId: artifact.id)) ?? []
    }

    private func loadSentences() {
        guard let db = model.db else { return }
        sentences = (try? db.listArtifactSentences(artifactId: artifact.id)) ?? []
    }

    private var isUITestImageInjectionEnabled: Bool {
        ProcessInfo.processInfo.environment["KIOKUN_UI_TEST_IMAGE_ATTACH"] == "1"
    }

    private func addUITestImage() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 24, height: 24))
        let data = renderer.pngData { context in
            UIColor.systemIndigo.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 24, height: 24))
            UIColor.white.setFill()
            context.fill(CGRect(x: 6, y: 6, width: 12, height: 12))
        }
        model.addImage(to: artifact, data: data)
        loadImages()
    }
}

struct LibraryView: View {
    var body: some View {
        NavigationStack {
            LibraryContentView()
        }
    }
}

struct LibraryContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        List {
            Section("Learning") {
                NavigationLink {
                    SentenceReaderView()
                } label: {
                    LibraryFeatureRow(title: "Sentence Reader", subtitle: "Tap through JA/ZH/KO sentences with offline dictionary lookup.", icon: "text.viewfinder")
                }
                .accessibilityIdentifier("library.sentenceReader")
                NavigationLink {
                    SentencePackView()
                } label: {
                    LibraryFeatureRow(title: "Sentence Examples", subtitle: "Browse bundled Chinese and Korean sentence shards.", icon: "quote.bubble")
                }
                NavigationLink {
                    ReelsView()
                } label: {
                    LibraryFeatureRow(title: "Reels", subtitle: "Offline Japanese and Chinese transcript browser.", icon: "play.rectangle")
                }
                NavigationLink {
                    StaticAssetsView()
                } label: {
                    LibraryFeatureRow(title: "Offline Packs", subtitle: "\(model.staticAssets.count) compressed static assets in this bundle.", icon: "externaldrive")
                }
            }
            Section("Reference") {
                NavigationLink {
                    HomophonesView()
                } label: {
                    LibraryFeatureRow(title: "Homophones", subtitle: "Chinese, Japanese, and Korean homophone explorers.", icon: "waveform")
                }
                NavigationLink {
                    FrequencyView()
                } label: {
                    LibraryFeatureRow(title: "Frequency", subtitle: "Bundled frequency list with dictionary links.", icon: "chart.bar")
                }
                NavigationLink {
                    PhoneticSeriesView(component: "青")
                } label: {
                    LibraryFeatureRow(title: "Phonetics", subtitle: "Browse sound-component series from bundled component data.", icon: "point.3.connected.trianglepath.dotted")
                }
            }
        }
        .navigationTitle("Library")
        .navigationDestination(for: String.self) { word in
            DictionaryDetailView(word: word)
        }
    }
}

struct LibraryFeatureRow: View {
    var title: String
    var subtitle: String
    var icon: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .frame(width: 32)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

private enum GameTileZone {
    case answer
    case bank
}

private struct GameLookupTarget: Identifiable {
    var id: String { word }
    var word: String
}

private struct GameTileLabel: View {
    var text: String
    var isSelected: Bool

    var body: some View {
        Text(text)
            .font(.body.weight(.medium))
            .lineLimit(2)
            .minimumScaleFactor(0.75)
            .foregroundStyle(isSelected ? Color.white : Color.primary)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(background, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(border, lineWidth: 1.5)
            }
            .shadow(color: shadow, radius: 0, x: 0, y: 2)
    }

    private var background: Color {
        isSelected ? Color.accentColor : Color(.secondarySystemGroupedBackground)
    }

    private var border: Color {
        isSelected ? Color.accentColor.opacity(0.9) : Color.secondary.opacity(0.22)
    }

    private var shadow: Color {
        isSelected ? Color.accentColor.opacity(0.35) : Color.black.opacity(0.10)
    }
}

private struct AccessibilityProbe: View {
    var identifier: String
    var label: String

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityIdentifier(identifier)
            .allowsHitTesting(false)
    }
}

struct GameDictionaryLookupSummary {
    var lookupWord: String
    var resolvedWord: String
    var language: LanguageCode
    var headword: String
    var reading: String
    var definitions: [String]
    var tags: [String]
    var inflectionText: String?
    var speechText: String

    init?(resolved: ResolvedDictionaryLookup, preferredLanguage: GameLanguage, lookupWord: String? = nil) {
        let sections = Self.orderedSections(in: resolved.record, preferredLanguage: preferredLanguage)
        guard let section = sections.first(where: { !$0.definitions.isEmpty }) ?? sections.first else {
            return nil
        }
        let headword = section.headword.trimmingCharacters(in: .whitespacesAndNewlines)
        let definitions = Self.demoteProperNouns(section.definitions)
        guard !headword.isEmpty, !definitions.isEmpty else {
            return nil
        }

        self.lookupWord = lookupWord ?? resolved.inflection?.original ?? resolved.record.key
        resolvedWord = resolved.inflection?.dictionaryForm ?? resolved.record.key
        language = section.language
        self.headword = headword
        reading = section.reading
        self.definitions = definitions
        tags = section.tags
        inflectionText = resolved.inflection.map { "\($0.original) -> \($0.dictionaryForm) (\($0.conjugationInfo))" }
        speechText = Self.speechText(from: headword)
    }

    private static func orderedSections(in record: DictionaryRecord, preferredLanguage: GameLanguage) -> [WordSection] {
        let chinese = uniqueSections(
            record.chineseWordEntries.map(Self.section(from:)) + record.chinese
        )
        let japanese = uniqueSections(
            record.japaneseWordEntries.map { $0.flattenedSection() } + record.japanese
        )
        let korean = uniqueSections(
            record.koreanWordEntries.map { $0.flattenedSection() } + record.korean
        )
        let grouped: [LanguageCode: [WordSection]] = [
            .zh: chinese,
            .ja: japanese,
            .ko: korean
        ]
        return languageOrder(for: preferredLanguage).flatMap { grouped[$0] ?? [] }
    }

    private static func section(from entry: ChineseWordEntry) -> WordSection {
        let headword = joinedUnique([entry.simplified, entry.traditional], separator: " / ")
        return WordSection(
            language: .zh,
            headword: headword.isEmpty ? entry.displayHeadword : headword,
            reading: entry.displayReading,
            definitions: entry.allDefinitions,
            tags: []
        )
    }

    private static func languageOrder(for preferredLanguage: GameLanguage) -> [LanguageCode] {
        switch preferredLanguage {
        case .zh: [.zh, .ja, .ko]
        case .ko: [.ko, .ja, .zh]
        case .ja, .tr: [.ja, .zh, .ko]
        }
    }

    private static func uniqueSections(_ sections: [WordSection]) -> [WordSection] {
        var seen = Set<String>()
        return sections.filter { section in
            let key = [
                section.language.rawValue,
                section.headword,
                section.reading,
                section.definitions.joined(separator: "\u{1F}")
            ].joined(separator: "\u{1E}")
            return seen.insert(key).inserted
        }
    }

    private static func speechText(from headword: String) -> String {
        var output = headword
        for marker in [" / ", "/", " (", "（", "、", ";"] {
            if let range = output.range(of: marker) {
                output = String(output[..<range.lowerBound])
            }
        }
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func demoteProperNouns(_ definitions: [String]) -> [String] {
        let unique = uniqueNonEmpty(definitions)
        var substantive: [String] = []
        var proper: [String] = []
        for definition in unique {
            if isProperNounDefinition(definition) {
                proper.append(definition)
            } else {
                substantive.append(definition)
            }
        }
        return substantive.isEmpty ? unique : substantive + proper
    }

    private static func isProperNounDefinition(_ definition: String) -> Bool {
        let trimmed = definition.trimmingCharacters(in: .whitespacesAndNewlines)
        let patterns = [
            #"^\(?(a |an |old )*(chinese )?surname\b"#,
            #"\bsurname\b"#,
            #"^\(?(a |an )?(place|given|personal|person'?s|family|clan|county|country|dynasty|era|reign) name\b"#,
            #"^name of (a|an|the)\b"#,
            #"^\(?(place ?name|placename|person ?name|given ?name)\)?$"#
        ]
        return patterns.contains { pattern in
            trimmed.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
        }
    }
}

private enum ChineseScriptMode: String, CaseIterable, Identifiable {
    case simplified
    case traditional

    var id: String { rawValue }

    var title: String {
        switch self {
        case .simplified: "简体"
        case .traditional: "繁體"
        }
    }
}

private struct GameDictionaryLookupSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    var target: GameLookupTarget
    var gameLanguage: GameLanguage
    var chineseScript: ChineseScriptMode

    private var resolved: ResolvedDictionaryLookup? {
        model.lookupResolved(target.word)
    }

    private var summary: GameDictionaryLookupSummary? {
        resolved.flatMap {
            GameDictionaryLookupSummary(
                resolved: $0,
                preferredLanguage: gameLanguage,
                lookupWord: target.word
            )
        }
    }

    var body: some View {
        List {
            content
        }
        .navigationTitle(target.word)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
        }
        .accessibilityIdentifier("game.lookupPanel")
    }

    @ViewBuilder
    private var content: some View {
        if let summary {
            summaryHeader(summary)
            definitionSection(summary)
            openEntrySection(word: summary.resolvedWord)
        } else if let record = resolved?.record {
            Section {
                ContentUnavailableView(
                    "No compact summary",
                    systemImage: "book.closed",
                    description: Text("This local entry has no word gloss for the game popup.")
                )
            }
            openEntrySection(word: record.key)
        } else {
            Section {
                ContentUnavailableView(
                    "No local entry",
                    systemImage: "magnifyingglass",
                    description: Text("Particles and inflected fragments often have no standalone entry.")
                )
            }
        }
    }

    private func summaryHeader(_ summary: GameDictionaryLookupSummary) -> some View {
        Section {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(displayText(summary.headword, language: summary.language))
                        .font(.title.weight(.semibold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.75)
                        .textSelection(.enabled)
                    if !summary.reading.isEmpty {
                        Text(summary.reading)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                }
                Spacer()
                NativeSpeechButton(
                    text: speechText(for: summary),
                    language: summary.language
                )
            }

            if let inflectionText = summary.inflectionText {
                Label(inflectionText, systemImage: "arrow.triangle.branch")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("game.lookupInflection")
            }

            let tags = Array(summary.tags.prefix(8))
            if !tags.isEmpty {
                FlowLayout(items: tags) { tag in
                    MetadataChip(text: tag)
                }
            }
        }
    }

    private func definitionSection(_ summary: GameDictionaryLookupSummary) -> some View {
        let definitions = Array(summary.definitions.prefix(6))
        return Section("Definitions") {
            ForEach(definitions.indices, id: \.self) { index in
                HStack(alignment: .top, spacing: 8) {
                    Text("\(index + 1).")
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 24, alignment: .trailing)
                    Text(definitions[index])
                        .textSelection(.enabled)
                }
            }
        }
    }

    private func openEntrySection(word: String) -> some View {
        Section {
            NavigationLink {
                DictionaryDetailView(word: word)
            } label: {
                Label("Open full entry", systemImage: "arrow.right.circle")
            }
            .accessibilityIdentifier("game.lookupOpenEntry")
        }
    }

    private func displayText(_ text: String, language: LanguageCode) -> String {
        guard language == .zh, gameLanguage == .zh, chineseScript == .traditional else {
            return text
        }
        return text.applyingTransform(StringTransform(rawValue: "Hans-Hant"), reverse: false) ?? text
    }

    private func speechText(for summary: GameDictionaryLookupSummary) -> String {
        displayText(summary.speechText, language: summary.language)
    }
}

struct GameView: View {
    @EnvironmentObject private var model: AppModel
    @AppStorage("chineseScript") private var chineseScriptRaw = ChineseScriptMode.simplified.rawValue
    @State private var exercise: GameExercise?
    @State private var language: GameLanguage = .ja
    @State private var answerTiles: [GameTile] = []
    @State private var bankTiles: [GameTile] = []
    @State private var resultText = ""
    @State private var speechSynthesizer = AVSpeechSynthesizer()
    @State private var lookupTarget: GameLookupTarget?
    @State private var askExtra = ""
    @State private var askCopied = false

    var current: GameLanguageExercise? {
        exercise?.exercises[language] ?? exercise?.exercises.values.first
    }

    private var chineseScript: ChineseScriptMode {
        get { ChineseScriptMode(rawValue: chineseScriptRaw) ?? .simplified }
        nonmutating set { chineseScriptRaw = newValue.rawValue }
    }

    var body: some View {
        List {
            if let exercise, let current {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Translate this sentence:")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(exercise.english)
                            .font(.title2.weight(.semibold))
                            .accessibilityIdentifier("game.english")
                        Text("Exercise \(exercise.exerciseId) · source \(exercise.sourceId)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Picker("Language", selection: $language) {
                        ForEach(GameLanguage.allCases.filter { exercise.exercises[$0] != nil }) { language in
                            Text(language.nativeTitle).tag(language)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: language) { _, _ in resetTiles() }
                    if language == .zh {
                        Picker("Script", selection: Binding(
                            get: { chineseScript },
                            set: { chineseScript = $0 }
                        )) {
                            ForEach(ChineseScriptMode.allCases) { script in
                                Text(script.title).tag(script)
                            }
                        }
                        .pickerStyle(.segmented)
                        .accessibilityIdentifier("game.chineseScript")
                    }
                }

                Section("Answer") {
                    VStack(alignment: .leading, spacing: 8) {
                        if answerTiles.isEmpty {
                            Text("Tap tiles below to build the sentence.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        } else {
                            FlowLayout(items: answerTiles) { tile in
                                Button {
                                    removeFromAnswer(tile)
                                } label: {
                                    GameTileLabel(
                                        text: displayText(tile.text),
                                        isSelected: true
                                    )
                                }
                                .buttonStyle(.plain)
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel(displayText(tile.text))
                                .accessibilityIdentifier("game.answerTile.\(tile.id)")
                                .onDrag { tileProvider(tile) }
                                .onDrop(of: [.plainText], isTargeted: nil) { providers in
                                    handleDrop(providers, to: .answer, before: tile.id)
                                }
                                .simultaneousGesture(LongPressGesture(minimumDuration: 0.45).onEnded { _ in
                                    openLookup(for: tile)
                                })
                            }
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
                    .background(.quaternary.opacity(0.24), in: RoundedRectangle(cornerRadius: 16))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(.secondary.opacity(0.35), style: StrokeStyle(lineWidth: 2, dash: [6, 5]))
                    }
                    if !resultText.isEmpty {
                        Text(resultText)
                            .font(.headline)
                            .foregroundStyle(resultText.hasPrefix("Correct") ? .green : .red)
                    }
                }
                .onDrop(of: [.plainText], isTargeted: nil) { providers in
                    handleDrop(providers, to: .answer)
                }

                Section("Tiles") {
                    VStack(alignment: .center, spacing: 8) {
                        FlowLayout(items: bankTiles, alignment: .center) { tile in
                            Button {
                                addToAnswer(tile)
                            } label: {
                                GameTileLabel(
                                    text: displayText(tile.text),
                                    isSelected: false
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(displayText(tile.text))
                            .accessibilityIdentifier("game.bankTile.\(tile.id)")
                            .onDrag { tileProvider(tile) }
                            .simultaneousGesture(LongPressGesture(minimumDuration: 0.45).onEnded { _ in
                                openLookup(for: tile)
                            })
                            .contextMenu {
                                NavigationLink(value: normalizedLookup(tile.text)) {
                                    Label("Open dictionary", systemImage: "book")
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(.quaternary.opacity(0.32), in: RoundedRectangle(cornerRadius: 16))
                }
                .onDrop(of: [.plainText], isTargeted: nil) { providers in
                    handleDrop(providers, to: .bank)
                }

                Section {
                    HStack(spacing: 12) {
                        Button {
                            resetTiles()
                        } label: {
                            Label("Reset", systemImage: "arrow.uturn.backward")
                        }
                        .buttonStyle(.bordered)
                        .disabled(answerTiles.isEmpty)
                        .accessibilityIdentifier("game.reset")

                        Button {
                            grade(current)
                        } label: {
                            Label("Check", systemImage: "checkmark.circle")
                        }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("game.check")
                    }

                    HStack(spacing: 12) {
                        Button {
                            speak(displayText(current.text))
                        } label: {
                            Label("Listen", systemImage: "speaker.wave.2")
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("game.listen")

                        Button {
                            answerTiles = current.tokens.enumerated().map { GameTile(id: 10_000 + $0.offset, text: $0.element) }
                            bankTiles = []
                            resultText = "Expected: \(displayText(current.text))"
                        } label: {
                            Label("Reveal", systemImage: "eye")
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("game.reveal")

                        Button {
                            loadRandom()
                        } label: {
                            Label("New", systemImage: "arrow.clockwise")
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("game.new")
                    }
                }

                Section("Ask") {
                    TextField("Extra question for the prompt", text: $askExtra)
                        .textInputAutocapitalization(.sentences)
                    Button {
                        copyAsk(current: current, exercise: exercise)
                    } label: {
                        Label(askCopied ? "Copied" : "Copy Ask", systemImage: askCopied ? "checkmark" : "doc.on.doc")
                    }
                    .accessibilityIdentifier("game.copyAsk")
                }
            } else {
                ContentUnavailableView("No offline game data", systemImage: "gamecontroller", description: Text("Build the SQLite bundle with --include-game-data to enable the sentence game."))
            }
        }
        .navigationTitle("Sentence Game")
        .task(id: model.db != nil) { loadRandom() }
        .sheet(item: $lookupTarget) { target in
            NavigationStack {
                GameDictionaryLookupSheet(
                    target: target,
                    gameLanguage: language,
                    chineseScript: chineseScript
                )
                    .environmentObject(model)
            }
        }
    }

    private func loadRandom() {
        guard let db = model.db else { return }
        do {
            exercise = try db.loadGameExercise()
            if let exercise {
                language = GameLanguage.allCases.first(where: { exercise.exercises[$0] != nil }) ?? .ja
            }
            resetTiles()
            resultText = ""
        } catch {
            model.statusMessage = "Game load failed: \(error.localizedDescription)"
        }
    }

    private func resetTiles() {
        answerTiles = []
        bankTiles = current?.tiles ?? []
        resultText = ""
    }

    private func addToAnswer(_ tile: GameTile) {
        answerTiles.append(tile)
        bankTiles.removeAll { $0.id == tile.id }
        resultText = ""
    }

    private func removeFromAnswer(_ tile: GameTile) {
        bankTiles.append(tile)
        answerTiles.removeAll { $0.id == tile.id }
        resultText = ""
    }

    private func tileProvider(_ tile: GameTile) -> NSItemProvider {
        NSItemProvider(object: String(tile.id) as NSString)
    }

    private func handleDrop(_ providers: [NSItemProvider], to zone: GameTileZone, before targetId: Int? = nil) -> Bool {
        guard let provider = providers.first(where: { $0.canLoadObject(ofClass: NSString.self) }) else {
            return false
        }
        provider.loadObject(ofClass: NSString.self) { object, _ in
            guard let string = object as? NSString, let tileId = Int(string as String) else { return }
            Task { @MainActor in
                moveTile(id: tileId, to: zone, before: targetId)
            }
        }
        return true
    }

    private func moveTile(id: Int, to zone: GameTileZone, before targetId: Int? = nil) {
        guard id != targetId else { return }
        let moving: GameTile?
        if let answerIndex = answerTiles.firstIndex(where: { $0.id == id }) {
            moving = answerTiles.remove(at: answerIndex)
        } else if let bankIndex = bankTiles.firstIndex(where: { $0.id == id }) {
            moving = bankTiles.remove(at: bankIndex)
        } else {
            moving = nil
        }

        guard let moving else { return }
        switch zone {
        case .answer:
            if let targetId, let targetIndex = answerTiles.firstIndex(where: { $0.id == targetId }) {
                answerTiles.insert(moving, at: targetIndex)
            } else {
                answerTiles.append(moving)
            }
        case .bank:
            bankTiles.append(moving)
        }
        resultText = ""
    }

    private func speak(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: speechLanguageCode)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
        speechSynthesizer.speak(utterance)
    }

    private var speechLanguageCode: String {
        switch language {
        case .ja: "ja-JP"
        case .zh: chineseScript == .traditional ? "zh-TW" : "zh-CN"
        case .ko: "ko-KR"
        case .tr: "tr-TR"
        }
    }

    private func grade(_ current: GameLanguageExercise) {
        let submittedTokens = answerTiles.map(\.text)
        let isCorrect: Bool
        if language == .ko || language == .tr {
            isCorrect = submittedTokens.map(LocalDatabase.normalizeGameAnswer) == current.tokens.map(LocalDatabase.normalizeGameAnswer)
        } else {
            isCorrect = LocalDatabase.normalizeGameAnswer(submittedTokens.joined()) == LocalDatabase.normalizeGameAnswer(current.text)
        }
        resultText = isCorrect ? "Correct" : "Not yet. Expected: \(displayText(current.text))"
    }

    private func openLookup(for tile: GameTile) {
        let word = normalizedLookup(tile.text)
        guard !word.isEmpty else { return }
        lookupTarget = GameLookupTarget(word: word)
    }

    private func normalizedLookup(_ text: String) -> String {
        let punctuation = CharacterSet(charactersIn: "。、，．！？!?.,…·「」『』（）()【】《》〈〉“”‘’\"'")
        return text
            .components(separatedBy: "(").first?
            .components(separatedBy: "/").first?
            .unicodeScalars
            .filter { !punctuation.contains($0) && !CharacterSet.whitespacesAndNewlines.contains($0) }
            .map(String.init)
            .joined() ?? text
    }

    private func displayText(_ text: String) -> String {
        guard language == .zh, chineseScript == .traditional else { return text }
        return text.applyingTransform(StringTransform(rawValue: "Hans-Hant"), reverse: false) ?? text
    }

    private func copyAsk(current: GameLanguageExercise, exercise: GameExercise) {
        let extraQuestions = askExtra
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let questions = [
            "Is this an accurate, natural translation of the English?",
            "I built the current answer tiles above. What did I get wrong, and what mistaken assumption led to it?",
            "Briefly explain the grammar of the correct answer so I understand the pattern."
        ] + extraQuestions

        let numberedQuestions = questions.enumerated()
            .map { "\($0.offset + 1). \($0.element)" }
            .joined(separator: "\n")
        let context = """
        ## Debug Context for Kiokun Sentence Game

        English: \(exercise.english)
        Language: \(language.title) (\(language.rawValue))
        Chinese script: \(language == .zh ? chineseScript.rawValue : "n/a")
        Target text: \(current.text)
        Displayed target text: \(displayText(current.text))
        Expected tokens: \(current.tokens)
        Current answer tiles: \(answerTiles.map(\.text))
        Displayed answer tiles: \(answerTiles.map { displayText($0.text) })
        Bank tiles: \(bankTiles.map(\.text))
        Exercise ID: \(exercise.exerciseId)
        Last result: \(resultText.isEmpty ? "none" : resultText)

        ## Questions

        \(numberedQuestions)
        """

        UIPasteboard.general.string = context
        askCopied = true
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            askCopied = false
        }
    }
}

struct StaticAssetsView: View {
    @EnvironmentObject private var model: AppModel

    var totalSourceBytes: Int {
        model.staticAssets.map(\.sourceBytes).reduce(0, +)
    }

    var totalCompressedBytes: Int {
        model.staticAssets.map(\.compressedBytes).reduce(0, +)
    }

    var body: some View {
        List {
            Section("Totals") {
                StatRow(title: "Assets", value: "\(model.staticAssets.count)")
                StatRow(title: "Original", value: byteString(totalSourceBytes))
                StatRow(title: "Compressed", value: byteString(totalCompressedBytes))
            }
            Section("Files") {
                ForEach(model.staticAssets) { asset in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(asset.path)
                            .font(.subheadline.weight(.medium))
                        Text("\(byteString(asset.sourceBytes)) -> \(byteString(asset.compressedBytes)) (\(asset.compressionRatio * 100, specifier: "%.0f")%)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Offline Packs")
    }
}

struct ReelsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var language: GameLanguage = .ja
    @State private var query = ""
    @State private var videos: [ReelVideo] = []
    @State private var visibleLimit = 50

    private var filteredVideos: [ReelVideo] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return videos }
        return videos.filter { video in
            [
                video.videoId,
                video.author,
                video.caption,
                video.sampleWord,
                video.sourceUrl
            ]
            .joined(separator: " ")
            .lowercased()
            .contains(needle)
        }
    }

    private var visibleVideos: [ReelVideo] {
        Array(filteredVideos.prefix(visibleLimit))
    }

    var body: some View {
        List {
            Section {
                Picker("Language", selection: $language) {
                    Text("Japanese").tag(GameLanguage.ja)
                    Text("Chinese").tag(GameLanguage.zh)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("reels.language")

                TextField("Search reels", text: $query)
                    .textInputAutocapitalization(.never)
                    .accessibilityIdentifier("reels.search")

                LabeledContent("Reels", value: "\(filteredVideos.count)")
            }

            if visibleVideos.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No reels",
                        systemImage: "play.rectangle",
                        description: Text("No bundled transcript metadata matches these filters.")
                    )
                }
            } else {
                Section(language.title) {
                    ForEach(visibleVideos) { video in
                        NavigationLink {
                            ReelDetailView(videoId: video.videoId, language: video.language)
                        } label: {
                            ReelVideoRow(video: video)
                        }
                        .accessibilityIdentifier("reels.videoLink.\(video.videoId)")
                    }
                }
                if visibleLimit < filteredVideos.count {
                    Section {
                        Button("Load more (\(filteredVideos.count - visibleLimit) remaining)") {
                            visibleLimit += 50
                        }
                        .accessibilityIdentifier("reels.loadMore")
                    }
                }
            }
        }
        .navigationTitle("Reels")
        .onChange(of: language) { _, _ in
            visibleLimit = 50
            load()
        }
        .onChange(of: query) { _, _ in visibleLimit = 50 }
        .task(id: model.db != nil) { load() }
    }

    private func load() {
        guard let db = model.db else { return }
        do {
            videos = try db.reelVideos(language: language)
        } catch {
            model.statusMessage = "Reels unavailable: \(error.localizedDescription)"
            videos = []
        }
    }
}

struct ReelVideoRow: View {
    var video: ReelVideo

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ReelThumbnail(urlString: video.thumbnail)
                .frame(width: 54, height: 86)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(video.language == .zh ? "中文" : "日本語")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    if let duration = video.duration {
                        Text(formatReelTime(duration))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    Text("\(video.wordCount) words")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Text(video.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)

                if !video.sampleWord.isEmpty {
                    Text(video.sampleWord)
                        .font(.caption)
                        .foregroundStyle(.tint)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityIdentifier("reels.video.\(video.videoId)")
    }
}

struct ReelThumbnail: View {
    var urlString: String

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.quaternary)
            Image(systemName: "play.fill")
                .font(.title3)
                .foregroundStyle(.secondary)
            if let url = URL(string: urlString), !urlString.isEmpty {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .scaledToFill()
                    }
                }
            }
        }
        .clipped()
    }
}

struct ReelDetailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let videoId: String
    let language: GameLanguage
    @State private var detail: ReelDetail?
    @State private var player: AVPlayer?
    @State private var timeObserver: Any?
    @State private var currentTime: Double = 0
    @State private var lookupTarget: ReelLookupTarget?
    @State private var selectedLookupWord = ""
    @State private var showingFullEntry = false

    private var activeSegmentIndex: Int {
        guard let transcript = detail?.transcript, !transcript.isEmpty else { return -1 }
        var latestStarted = 0
        for index in transcript.indices {
            let segment = transcript[index]
            if currentTime >= segment.startTime, currentTime <= segment.endTime {
                return index
            }
            if currentTime >= segment.startTime {
                latestStarted = index
            }
            if currentTime < segment.startTime {
                break
            }
        }
        return latestStarted
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()
                AccessibilityProbe(identifier: "reels.fullScreen", label: "Reel")
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                if let detail {
                    ReelPlayerBackdrop(detail: detail, player: player)
                        .ignoresSafeArea()
                        .accessibilityIdentifier("reels.videoPlayer")

                    VStack(spacing: 0) {
                        reelTopOverlay(detail: detail, safeTop: proxy.safeAreaInsets.top)
                        Spacer(minLength: 0)
                        if detail.transcript.isEmpty {
                            ContentUnavailableView("No transcript", systemImage: "text.bubble")
                                .foregroundStyle(.white)
                                .padding(.bottom, proxy.safeAreaInsets.bottom + 40)
                        } else {
                            ReelTranscriptOverlay(
                                transcript: detail.transcript,
                                language: language,
                                currentTime: currentTime,
                                activeSegmentIndex: activeSegmentIndex,
                                maxHeight: min(proxy.size.height * 0.42, 360),
                                bottomPadding: proxy.safeAreaInsets.bottom + 24,
                                onSeek: seek(to:),
                                onSelectWord: openLookup(word:)
                            )
                        }
                    }
                    .ignoresSafeArea(edges: [.top, .bottom])
                } else {
                    VStack(spacing: 12) {
                        ProgressView()
                            .tint(.white)
                        Text("Loading reel")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    .accessibilityIdentifier("reels.loading")

                    VStack {
                        HStack {
                            backButton
                            Spacer()
                        }
                        .padding(.top, proxy.safeAreaInsets.top + 8)
                        .padding(.horizontal, 12)
                        Spacer()
                    }
                    .ignoresSafeArea(edges: .top)
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .background(.black)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .preferredColorScheme(.dark)
        .sheet(item: $lookupTarget) { target in
            NavigationStack {
                ReelDictionaryLookupSheet(target: target, language: language) { word in
                    openFullEntry(word)
                }
                .environmentObject(model)
            }
            .presentationDetents([.medium, .large])
        }
        .navigationDestination(isPresented: $showingFullEntry) {
            DictionaryDetailView(word: selectedLookupWord)
                .toolbar(.visible, for: .navigationBar)
                .navigationBarBackButtonHidden(false)
        }
        .task(id: model.db != nil) { load() }
        .onDisappear {
            player?.pause()
            removeTimeObserver()
        }
    }

    private func reelTopOverlay(detail: ReelDetail, safeTop: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 10) {
            backButton

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    if !detail.video.author.isEmpty {
                        Text(detail.video.author)
                            .font(.caption.weight(.semibold))
                    }
                    if let duration = detail.video.duration {
                        Text(formatReelTime(duration))
                            .font(.caption.monospacedDigit())
                    }
                }
                .foregroundStyle(.white.opacity(0.88))

                if !detail.video.caption.isEmpty {
                    Text(detail.video.caption)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(2)
                }
            }
            .shadow(color: .black.opacity(0.72), radius: 8, y: 2)

            Spacer(minLength: 0)

            if let sourceURL = URL(string: detail.video.sourceUrl), !detail.video.sourceUrl.isEmpty {
                Link(destination: sourceURL) {
                    Image(systemName: "arrow.up.forward")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 34, height: 34)
                        .background(.black.opacity(0.35), in: Circle())
                        .overlay {
                            Circle().stroke(.white.opacity(0.16), lineWidth: 1)
                        }
                }
                .accessibilityLabel("Open source")
                .accessibilityIdentifier("reels.source")
            }
        }
        .padding(.top, safeTop + 8)
        .padding(.horizontal, 12)
    }

    private var backButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "chevron.left")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(.black.opacity(0.38), in: Circle())
                .overlay {
                    Circle().stroke(.white.opacity(0.14), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back")
        .accessibilityIdentifier("reels.back")
    }

    private func openLookup(word: String) {
        let lookup = cleanReelLookupWord(word)
        guard !lookup.isEmpty else { return }
        player?.pause()
        lookupTarget = ReelLookupTarget(word: lookup)
    }

    private func openFullEntry(_ word: String) {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        lookupTarget = nil
        selectedLookupWord = trimmed
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            showingFullEntry = true
        }
    }

    private func seek(to seconds: Double) {
        guard seconds.isFinite else { return }
        currentTime = max(0, seconds)
        player?.seek(to: CMTime(seconds: currentTime, preferredTimescale: 600))
        player?.play()
    }

    private func load() {
        guard let db = model.db else { return }
        do {
            guard let loaded = try db.reelDetail(videoId: videoId, language: language) else {
                model.statusMessage = "Reel unavailable"
                return
            }
            detail = loaded
            currentTime = 0
            configurePlayer(for: loaded)
        } catch {
            model.statusMessage = "Reel unavailable: \(error.localizedDescription)"
        }
    }

    private func configurePlayer(for detail: ReelDetail) {
        removeTimeObserver()
        guard let url = URL(string: detail.video.url), !detail.video.url.isEmpty else {
            player = nil
            return
        }
        let nextPlayer = AVPlayer(url: url)
        player = nextPlayer
        timeObserver = nextPlayer.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.2, preferredTimescale: 600),
            queue: .main
        ) { time in
            Task { @MainActor in
                currentTime = time.seconds
            }
        }
    }

    private func removeTimeObserver() {
        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
    }
}

struct ReelPlayerBackdrop: View {
    var detail: ReelDetail
    var player: AVPlayer?

    var body: some View {
        ZStack {
            Color.black
            ReelThumbnail(urlString: detail.video.thumbnail)
                .scaledToFill()
                .opacity(0.72)
                .overlay {
                    LinearGradient(
                        colors: [.black.opacity(0.24), .black.opacity(0.08), .black.opacity(0.48)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }
                .ignoresSafeArea()

            if let player {
                VideoPlayer(player: player)
                    .aspectRatio(9 / 16, contentMode: .fill)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .background(.black)
            }
        }
    }
}

private struct ReelLookupTarget: Identifiable {
    var id: String { word }
    var word: String
}

private struct ReelDictionaryLookupSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    var target: ReelLookupTarget
    var language: GameLanguage
    var onOpenEntry: (String) -> Void

    private var resolved: ResolvedDictionaryLookup? {
        model.lookupResolved(target.word)
    }

    private var summary: GameDictionaryLookupSummary? {
        resolved.flatMap {
            GameDictionaryLookupSummary(
                resolved: $0,
                preferredLanguage: language,
                lookupWord: target.word
            )
        }
    }

    var body: some View {
        List {
            if let summary {
                Section {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(summary.headword)
                                .font(.title.weight(.semibold))
                                .lineLimit(2)
                                .minimumScaleFactor(0.75)
                            if !summary.reading.isEmpty {
                                Text(summary.reading)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        NativeSpeechButton(text: summary.speechText, language: summary.language)
                    }

                    if let inflectionText = summary.inflectionText {
                        Label(inflectionText, systemImage: "arrow.triangle.branch")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .accessibilityIdentifier("reels.lookupInflection")
                    }

                    if !summary.tags.isEmpty {
                        FlowLayout(items: Array(summary.tags.prefix(8))) { tag in
                            MetadataChip(text: tag)
                        }
                    }
                }

                Section("Definitions") {
                    ForEach(Array(summary.definitions.prefix(6).enumerated()), id: \.offset) { index, definition in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(index + 1).")
                                .font(.caption.monospacedDigit().weight(.semibold))
                                .foregroundStyle(.secondary)
                                .frame(width: 24, alignment: .trailing)
                            Text(definition)
                                .textSelection(.enabled)
                        }
                    }
                }

                Section {
                    Button {
                        onOpenEntry(summary.resolvedWord)
                    } label: {
                        Label("Open full entry", systemImage: "arrow.right.circle")
                    }
                    .accessibilityIdentifier("reels.lookupOpenEntry")
                }
            } else if let record = resolved?.record {
                Section {
                    ContentUnavailableView(
                        "No compact summary",
                        systemImage: "book.closed",
                        description: Text("This local entry has no compact reel gloss.")
                    )
                }
                Section {
                    Button {
                        onOpenEntry(record.key)
                    } label: {
                        Label("Open full entry", systemImage: "arrow.right.circle")
                    }
                    .accessibilityIdentifier("reels.lookupOpenEntry")
                }
            } else {
                Section {
                    ContentUnavailableView(
                        "No local entry",
                        systemImage: "magnifyingglass",
                        description: Text("This transcript token is not in the bundled dictionary.")
                    )
                }
            }
        }
        .navigationTitle(target.word)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
        }
        .accessibilityIdentifier("reels.lookupPanel")
    }
}

struct ReelTranscriptOverlay: View {
    var transcript: [ReelTranscriptSegment]
    var language: GameLanguage
    var currentTime: Double
    var activeSegmentIndex: Int
    var maxHeight: CGFloat
    var bottomPadding: CGFloat
    var onSeek: (Double) -> Void
    var onSelectWord: (String) -> Void

    var body: some View {
        ZStack(alignment: .topLeading) {
            AccessibilityProbe(identifier: "reels.transcriptOverlay", label: "Transcript")

            ScrollViewReader { reader in
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 2) {
                        Color.clear
                            .frame(height: maxHeight * 0.28)
                        ForEach(Array(transcript.enumerated()), id: \.offset) { index, segment in
                            ReelTranscriptOverlaySegment(
                                segment: segment,
                                language: language,
                                isActive: index == activeSegmentIndex,
                                isPast: index < activeSegmentIndex,
                                activeWordIndex: activeWordIndex(for: segment),
                                onSeek: { onSeek(segment.startTime) },
                                onSelectWord: onSelectWord
                            )
                            .id(index)
                        }
                        Color.clear
                            .frame(height: maxHeight * 0.28)
                    }
                }
                .frame(maxHeight: maxHeight)
                .scrollClipDisabled()
                .onAppear {
                    if activeSegmentIndex >= 0 {
                        reader.scrollTo(activeSegmentIndex, anchor: .center)
                    }
                }
                .onChange(of: activeSegmentIndex) { _, index in
                    guard index >= 0 else { return }
                    withAnimation(.easeInOut(duration: 0.25)) {
                        reader.scrollTo(index, anchor: .center)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, bottomPadding)
        .background {
            LinearGradient(
                colors: [
                    .black.opacity(0),
                    .black.opacity(0.18),
                    .black.opacity(0.18),
                    .black.opacity(0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    private func activeWordIndex(for segment: ReelTranscriptSegment) -> Int {
        let words = reelDisplayWords(for: segment, language: language)
            .filter { !cleanReelLookupWord($0).isEmpty }
        guard !words.isEmpty else { return -1 }
        let duration = max(segment.endTime - segment.startTime, 0.1)
        let progress = min(max((currentTime - segment.startTime) / duration, 0), 0.999)
        return Int((progress * Double(words.count)).rounded(.down))
    }
}

struct ReelTranscriptOverlaySegment: View {
    var segment: ReelTranscriptSegment
    var language: GameLanguage
    var isActive: Bool
    var isPast: Bool
    var activeWordIndex: Int
    var onSeek: () -> Void
    var onSelectWord: (String) -> Void

    private var tokens: [ReelTranscriptToken] {
        reelSegmentTokens(for: segment, language: language)
    }

    var body: some View {
        FlowLayout(items: tokens, alignment: .center) { token in
            if let lookupWord = token.lookupWord {
                Button {
                    onSelectWord(lookupWord)
                } label: {
                    Text(token.text)
                        .font(isActive ? .headline.weight(.semibold) : .callout.weight(.medium))
                        .foregroundStyle(tokenColor)
                        .underline(isActive && token.lookupIndex == activeWordIndex, color: .white.opacity(0.9))
                        .padding(.horizontal, 1)
                        .background {
                            if isActive && token.lookupIndex == activeWordIndex {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(.white.opacity(0.16))
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(token.text)
                .accessibilityIdentifier("reels.word.\(lookupWord)")
            } else {
                Text(token.text)
                    .font(isActive ? .headline.weight(.semibold) : .callout.weight(.medium))
                    .foregroundStyle(tokenColor)
            }
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, isActive ? 10 : 9)
        .padding(.vertical, isActive ? 7 : 4)
        .frame(maxWidth: .infinity)
        .background {
            if isActive {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.black.opacity(0.26))
                    .background(.ultraThinMaterial.opacity(0.25), in: RoundedRectangle(cornerRadius: 8))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(.white.opacity(0.12), lineWidth: 1)
                    }
            }
        }
        .shadow(color: .black.opacity(0.82), radius: 8, y: 2)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSeek)
    }

    private var tokenColor: Color {
        if isActive { return .white }
        return .white.opacity(isPast ? 0.36 : 0.62)
    }
}

struct ReelTranscriptToken: Hashable {
    var id: Int
    var text: String
    var lookupWord: String?
    var lookupIndex: Int
}

private func reelSegmentTokens(for segment: ReelTranscriptSegment, language: GameLanguage) -> [ReelTranscriptToken] {
    let words = reelDisplayWords(for: segment, language: language)
    guard !words.isEmpty else {
        return [ReelTranscriptToken(id: 0, text: segment.sentence, lookupWord: nil, lookupIndex: -1)]
    }

    var tokens: [ReelTranscriptToken] = []
    var cursor = segment.sentence.startIndex
    var lookupIndex = 0

    func appendToken(_ text: String, lookup: String?) {
        guard !text.isEmpty else { return }
        let cleaned = lookup.map(cleanReelLookupWord) ?? ""
        tokens.append(
            ReelTranscriptToken(
                id: tokens.count,
                text: text,
                lookupWord: cleaned.isEmpty ? nil : cleaned,
                lookupIndex: cleaned.isEmpty ? -1 : lookupIndex
            )
        )
        if !cleaned.isEmpty {
            lookupIndex += 1
        }
    }

    for word in words {
        if let range = segment.sentence[cursor...].range(of: word) {
            if range.lowerBound > cursor {
                appendToken(String(segment.sentence[cursor..<range.lowerBound]), lookup: nil)
            }
            appendToken(word, lookup: word)
            cursor = range.upperBound
        } else {
            appendToken(word, lookup: word)
        }
    }

    if cursor < segment.sentence.endIndex {
        appendToken(String(segment.sentence[cursor..<segment.sentence.endIndex]), lookup: nil)
    }

    return tokens.isEmpty ? [ReelTranscriptToken(id: 0, text: segment.sentence, lookupWord: nil, lookupIndex: -1)] : tokens
}

private func reelDisplayWords(for segment: ReelTranscriptSegment, language: GameLanguage) -> [String] {
    var merged: [String] = []
    for rawWord in segment.words.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !rawWord.isEmpty {
        if let previous = merged.last, shouldMergeJapaneseReelSuffix(previous: previous, suffix: rawWord, language: language) {
            merged[merged.count - 1] = previous + rawWord
        } else {
            merged.append(rawWord)
        }
    }
    return merged
}

private func shouldMergeJapaneseReelSuffix(previous: String, suffix: String, language: GameLanguage) -> Bool {
    guard language == .ja, !previous.isEmpty else { return false }
    guard ["て", "で", "たら", "だら", "たり", "だり"].contains(suffix) else { return false }
    return previous.range(of: #"[いきぎしじちっにびみりん来]$"#, options: .regularExpression) != nil
}

private struct IndexedReelWord: Hashable {
    var index: Int
    var word: String
}

struct ReelTranscriptSegmentRow: View {
    var segment: ReelTranscriptSegment
    var onSelectWord: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(formatReelTime(segment.startTime))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer()
                if let confidence = segment.confidence {
                    Text("\(confidence * 100, specifier: "%.0f")%")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.tertiary)
                }
            }
            Text(segment.sentence)
                .font(.body)
            if !segment.words.isEmpty {
                FlowLayout(items: Array(segment.words.enumerated().map { IndexedReelWord(index: $0.offset, word: $0.element) })) { indexed in
                    let lookup = cleanReelLookupWord(indexed.word)
                        if lookup.isEmpty {
                            Text(indexed.word)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            Button {
                                onSelectWord(lookup)
                            } label: {
                                Text(indexed.word)
                                    .font(.caption.weight(.medium))
                                    .lineLimit(1)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 5)
                                    .background(.quaternary, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(indexed.word)
                            .accessibilityIdentifier("reels.word.\(lookup)")
                        }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private func formatReelTime(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00" }
    let totalSeconds = max(0, Int(seconds.rounded(.down)))
    let minutes = totalSeconds / 60
    let seconds = totalSeconds % 60
    return "\(minutes):\(String(format: "%02d", seconds))"
}

private func cleanReelLookupWord(_ word: String) -> String {
    let punctuation = CharacterSet(charactersIn: "。、，．！？!?.,…·「」『』（）()【】《》〈〉“”‘’\"'")
    return word.unicodeScalars
        .filter { !punctuation.contains($0) && !CharacterSet.whitespacesAndNewlines.contains($0) }
        .map(String.init)
        .joined()
}

struct HomophonesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var language: GameLanguage = .ja
    @State private var mode: HomophoneMode = .words
    @State private var query = ""
    @State private var minGroupSize = 2
    @State private var syllableCount = 0
    @State private var commonOnly = false
    @State private var visibleLimit = 50
    @State private var groups: [HomophoneGroup] = []
    @State private var modeCounts: [HomophoneMode: Int] = [:]

    private var minGroupOptions: [Int] {
        language == .ko ? [2, 5, 10, 20, 50] : [2, 3, 5, 10]
    }

    private var searchPlaceholder: String {
        switch language {
        case .ja: "Reading, kanji, romaji, or meaning"
        case .zh: "Pinyin, hanzi, or meaning"
        case .ko: "Hangul, hanja, or meaning"
        case .tr: "Reading or word"
        }
    }

    private var filteredGroups: [HomophoneGroup] {
        let rawNeedle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let latinJapaneseNeedle = language == .ja && rawNeedle.range(of: #"^[a-z]+$"#, options: .regularExpression) != nil
            ? LocalDatabase.romajiToHiragana(rawNeedle)
            : rawNeedle

        return groups.filter { group in
            guard group.entries.count >= minGroupSize else { return false }
            if language == .ja, syllableCount > 0, LocalDatabase.countJapaneseMorae(group.reading) != syllableCount {
                return false
            }
            if language == .ja, commonOnly, !group.entries.contains(where: \.isCommon) {
                return false
            }
            guard !rawNeedle.isEmpty else { return true }

            let readingText = "\(group.reading) \(group.displayReading)".lowercased()
            if readingText.contains(rawNeedle) || readingText.contains(latinJapaneseNeedle) {
                return true
            }
            return group.entries.contains { entry in
                entry.searchText.contains(rawNeedle) || entry.searchText.contains(latinJapaneseNeedle)
            }
        }
    }

    private var visibleGroups: [HomophoneGroup] {
        Array(filteredGroups.prefix(visibleLimit))
    }

    var body: some View {
        List {
            Section {
                Picker("Language", selection: $language) {
                    Text("Japanese").tag(GameLanguage.ja)
                    Text("Chinese").tag(GameLanguage.zh)
                    Text("Korean").tag(GameLanguage.ko)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("homophones.language")

                if language != .ko {
                    Picker("Mode", selection: $mode) {
                        ForEach(HomophoneMode.allCases) { item in
                            Text("\(item.title) \(modeCounts[item].map { "(\($0))" } ?? "")")
                                .tag(item)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("homophones.mode")
                }

                TextField(searchPlaceholder, text: $query)
                    .textInputAutocapitalization(.never)
                    .accessibilityIdentifier("homophones.search")

                Picker("Min group", selection: $minGroupSize) {
                    ForEach(minGroupOptions, id: \.self) { size in
                        Text("\(size)+").tag(size)
                    }
                }
                .accessibilityIdentifier("homophones.minGroup")

                if language == .ja {
                    Picker("Syllables", selection: $syllableCount) {
                        Text("Any").tag(0)
                        ForEach(1...6, id: \.self) { count in
                            Text("\(count)").tag(count)
                        }
                    }
                    .accessibilityIdentifier("homophones.syllables")

                    Toggle("Common only", isOn: $commonOnly)
                        .accessibilityIdentifier("homophones.commonOnly")
                }
            }

            Section {
                LabeledContent("Groups", value: "\(filteredGroups.count)")
                LabeledContent("Showing", value: "\(visibleGroups.count)")
            }

            if visibleGroups.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No homophones",
                        systemImage: "waveform",
                        description: Text("No offline groups match these filters.")
                    )
                }
            } else {
                Section("Groups") {
                    ForEach(visibleGroups) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(group.displayReading)
                                    .font(.headline)
                                Spacer()
                                Text(group.countLabel)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .accessibilityElement(children: .combine)
                            .accessibilityIdentifier("homophones.group.\(group.reading)")

                            ForEach(group.entries) { entry in
                                HomophoneEntryRow(group: group, entry: entry)
                            }
                        }
                    }
                }

                if visibleLimit < filteredGroups.count {
                    Section {
                        Button("Load more (\(filteredGroups.count - visibleLimit) remaining)") {
                            visibleLimit += 50
                        }
                        .accessibilityIdentifier("homophones.loadMore")
                    }
                }
            }
        }
        .navigationTitle("Homophones")
        .onChange(of: query) { _, _ in visibleLimit = 50 }
        .onChange(of: minGroupSize) { _, _ in visibleLimit = 50 }
        .onChange(of: syllableCount) { _, _ in visibleLimit = 50 }
        .onChange(of: commonOnly) { _, _ in visibleLimit = 50 }
        .onChange(of: language) { _, newValue in
            if newValue == .ko { mode = .words }
            if newValue != .ja {
                syllableCount = 0
                commonOnly = false
            }
            if !minGroupOptions.contains(minGroupSize) {
                minGroupSize = 2
            }
            visibleLimit = 50
            load()
        }
        .onChange(of: mode) { _, _ in
            visibleLimit = 50
            load()
        }
        .task(id: model.db != nil) { load() }
    }

    private func load() {
        guard let db = model.db else { return }
        do {
            let effectiveMode: HomophoneMode = language == .ko ? .words : mode
            groups = try db.homophoneGroups(language: language, mode: effectiveMode)
            if language == .ko {
                modeCounts = [.words: groups.count]
            } else {
                var counts: [HomophoneMode: Int] = [:]
                for availableMode in HomophoneMode.allCases {
                    counts[availableMode] = try db.homophoneGroups(language: language, mode: availableMode).count
                }
                modeCounts = counts
            }
        } catch {
            model.statusMessage = "Homophones unavailable: \(error.localizedDescription)"
        }
    }
}

struct HomophoneEntryRow: View {
    var group: HomophoneGroup
    var entry: HomophoneEntry

    var body: some View {
        NavigationLink(value: entry.word) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(entry.word)
                        .font(group.language == .ko ? .title3.weight(.semibold) : .headline)
                    if entry.isCommon {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundStyle(.yellow)
                            .accessibilityLabel("Common")
                    }
                    if let accent = entry.accent, group.language == .ja {
                        PitchAccentPatternView(pattern: PitchAccentPattern(word: entry.word, reading: group.reading, accent: accent))
                    }
                    Spacer(minLength: 0)
                }

                if !secondaryReading.isEmpty {
                    Text(secondaryReading)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !entry.definition.isEmpty {
                    Text(entry.definition)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }

                if !entry.partsOfSpeech.isEmpty {
                    Text(entry.partsOfSpeech.joined(separator: ", "))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .accessibilityIdentifier("homophones.entry.\(entry.word)")
    }

    private var secondaryReading: String {
        switch group.language {
        case .zh:
            entry.pinyin.isEmpty ? "" : "[\(entry.pinyin)]"
        case .ko:
            entry.hangul.isEmpty || entry.hangul == group.reading ? "" : entry.hangul
        case .ja:
            group.mode == .characters ? group.reading : ""
        case .tr:
            ""
        }
    }
}

struct FrequencyView: View {
    @EnvironmentObject private var model: AppModel
    @State private var language: GameLanguage = .ja
    @State private var query = ""
    @State private var displayCount = 100
    @State private var rowsByLanguage: [GameLanguage: [FrequencyEntry]] = [:]

    private let languages: [GameLanguage] = [.ja, .zh, .ko]

    private var activeRows: [FrequencyEntry] {
        rowsByLanguage[language] ?? []
    }

    private var filteredRows: [FrequencyEntry] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return activeRows }
        return activeRows.filter { $0.searchText.contains(needle) }
    }

    private var visibleRows: [FrequencyEntry] {
        Array(filteredRows.prefix(displayCount))
    }

    var body: some View {
        List {
            Section {
                Picker("Language", selection: $language) {
                    ForEach(languages) { item in
                        Text(item.nativeTitle).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("frequency.language")

                TextField("Filter frequency list", text: $query)
                    .textInputAutocapitalization(.never)
                    .accessibilityIdentifier("frequency.search")
                LabeledContent(language.title, value: "\(filteredRows.count) / \(activeRows.count)")
            }

            if visibleRows.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No frequency rows",
                        systemImage: "chart.bar",
                        description: Text("No offline entries match this language and filter.")
                    )
                }
            } else {
                Section(language.title) {
                    ForEach(visibleRows) { row in
                        FrequencyEntryRow(row: row)
                    }
                }

                if displayCount < filteredRows.count {
                    Section {
                        Button("Load more (\(displayCount) / \(filteredRows.count))") {
                            displayCount = min(displayCount + 100, filteredRows.count)
                        }
                        .accessibilityIdentifier("frequency.loadMore")
                    }
                }
            }
        }
        .navigationTitle("Frequency")
        .onChange(of: query) { _, _ in displayCount = 100 }
        .onChange(of: language) { _, _ in displayCount = 100 }
        .task(id: model.db != nil) { load() }
    }

    private func load() {
        guard let db = model.db else { return }
        do {
            var loaded: [GameLanguage: [FrequencyEntry]] = [:]
            for item in languages {
                loaded[item] = try db.frequencyEntries(language: item)
            }
            rowsByLanguage = loaded
        } catch {
            model.statusMessage = "Frequency unavailable: \(error.localizedDescription)"
        }
    }
}

struct FrequencyEntryRow: View {
    var row: FrequencyEntry

    var body: some View {
        NavigationLink(value: row.word) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("#\(row.rank)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .frame(minWidth: 44, alignment: .leading)
                    Text(row.word)
                        .font(.headline)
                    if !row.reading.isEmpty {
                        Text(row.reading)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if row.isCommon {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundStyle(.yellow)
                            .accessibilityLabel("Common")
                    }
                }
                if !row.definition.isEmpty {
                    Text(row.definition)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .accessibilityIdentifier("frequency.entry.\(row.word)")
    }
}

struct SentencePackView: View {
    @EnvironmentObject private var model: AppModel
    @State private var language: GameLanguage = .zh
    @State private var query = ""
    @State private var rows: [EntryPreview] = []

    var body: some View {
        List {
            Section {
                Picker("Language", selection: $language) {
                    Text("Chinese").tag(GameLanguage.zh)
                    Text("Korean").tag(GameLanguage.ko)
                }
                .pickerStyle(.segmented)
                TextField("Filter sentences", text: $query)
            }
            Section("Sentences") {
                ForEach(rows) { row in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(row.word)
                        if !row.reading.isEmpty {
                            Text(row.reading).font(.caption).foregroundStyle(.secondary)
                        }
                        Text(row.definition).font(.subheadline).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 3)
                }
            }
        }
        .navigationTitle("Sentences")
        .onChange(of: query) { _, _ in load() }
        .onChange(of: language) { _, _ in load() }
        .task(id: model.db != nil) { load() }
    }

    private func load() {
        guard let db = model.db else { return }
        do {
            let path = language == .zh ? "zh_sentences/0.json" : "kr_sentences/0.json"
            guard let text = try db.staticAssetText(path: path),
                  let data = text.data(using: .utf8),
                  let array = try JSONSerialization.jsonObject(with: data) as? [[Any]]
            else {
                rows = []
                return
            }
            let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            rows = array.compactMap { item -> EntryPreview? in
                if language == .zh {
                    let simp = item.count > 0 ? "\(item[0])" : ""
                    let trad = item.count > 1 ? "\(item[1])" : ""
                    let english = item.count > 2 ? "\(item[2])" : ""
                    let pinyin = item.count > 3 ? "\(item[3])" : ""
                    guard needle.isEmpty || simp.lowercased().contains(needle) || trad.lowercased().contains(needle) || english.lowercased().contains(needle) else { return nil }
                    return EntryPreview(word: simp, reading: pinyin, definition: english, isCommon: false)
                } else {
                    let korean = item.count > 0 ? "\(item[0])" : ""
                    let english = item.count > 1 ? "\(item[1])" : ""
                    guard needle.isEmpty || korean.lowercased().contains(needle) || english.lowercased().contains(needle) else { return nil }
                    return EntryPreview(word: korean, reading: "", definition: english, isCommon: false)
                }
            }
            .prefix(100)
            .map { $0 }
        } catch {
            model.statusMessage = "Sentences unavailable: \(error.localizedDescription)"
        }
    }
}

func byteString(_ bytes: Int) -> String {
    ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
}

func cleanComponentGloss(_ gloss: String) -> String {
    gloss
        .replacingOccurrences(of: "(trad/jp)", with: "traditional/Japanese", options: .caseInsensitive)
        .replacingOccurrences(of: "(trad)", with: "traditional", options: .caseInsensitive)
        .replacingOccurrences(of: "(simp)", with: "simplified", options: .caseInsensitive)
        .replacingOccurrences(of: "(jp)", with: "Japanese", options: .caseInsensitive)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

final class CredentialCookieTextView: UITextView {
    private static weak var activeEditor: CredentialCookieTextView?

    var onTextChange: ((String) -> Void)?
    static var activeText: String? { activeEditor?.text }
    static func activate(_ editor: CredentialCookieTextView) {
        activeEditor = editor
    }

    override var text: String! {
        didSet { notifyTextChange() }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            Self.activeEditor = self
        }
    }

    override func becomeFirstResponder() -> Bool {
        Self.activeEditor = self
        return super.becomeFirstResponder()
    }

    override func insertText(_ text: String) {
        super.insertText(text)
        notifyTextChange()
    }

    override func replace(_ range: UITextRange, withText text: String) {
        super.replace(range, withText: text)
        notifyTextChange()
    }

    override func deleteBackward() {
        super.deleteBackward()
        notifyTextChange()
    }

    override func paste(_ sender: Any?) {
        super.paste(sender)
        notifyTextChange()
    }

    private func notifyTextChange() {
        onTextChange?(text ?? "")
    }
}

struct CredentialCookieEditor: UIViewRepresentable {
    @Binding var text: String

    func makeUIView(context: Context) -> CredentialCookieTextView {
        let textView = CredentialCookieTextView()
        CredentialCookieTextView.activate(textView)
        textView.delegate = context.coordinator
        textView.onTextChange = { context.coordinator.text.wrappedValue = $0 }
        textView.font = UIFont.preferredFont(forTextStyle: .body)
        textView.adjustsFontForContentSizeCategory = true
        textView.backgroundColor = .clear
        textView.autocapitalizationType = .none
        textView.autocorrectionType = .no
        textView.keyboardType = .URL
        textView.textContentType = .password
        textView.textContainer.lineFragmentPadding = 0
        textView.accessibilityIdentifier = "settings.cloudflareCookie"
        return textView
    }

    func updateUIView(_ textView: CredentialCookieTextView, context: Context) {
        CredentialCookieTextView.activate(textView)
        if textView.text != text {
            textView.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var text: Binding<String>

        init(text: Binding<String>) {
            self.text = text
        }

        func textViewDidChange(_ textView: UITextView) {
            text.wrappedValue = textView.text
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            if let credentialTextView = textView as? CredentialCookieTextView {
                CredentialCookieTextView.activate(credentialTextView)
            }
        }
    }
}

struct SettingsView: View {
    var body: some View {
        NavigationStack {
            SettingsContentView()
        }
    }
}

struct SettingsContentView: View {
    @EnvironmentObject private var model: AppModel
    @AppStorage("cloudflareBaseURL") private var cloudflareBaseURL = ""
    @AppStorage("appColorScheme") private var appColorScheme = "system"
    @State private var cloudflareSessionCookie = ""
    @State private var credentialStatus = ""
    @State private var authInProgress = false
    @State private var authCoordinator: NativeAuthSessionCoordinator?

    var body: some View {
        Form {
            Section("Appearance") {
                Picker("Theme", selection: $appColorScheme) {
                    Text("System").tag("system")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }
                .pickerStyle(.segmented)
            }

            Section("Offline") {
                StatRow(title: "Notes", value: "\(model.notes.count)")
                StatRow(title: "Study cards", value: "\(model.studyCards.count)")
                StatRow(title: "Custom words", value: "\(model.customWords.count)")
                StatRow(title: "Artifacts", value: "\(model.artifacts.count)")
                StatRow(title: "Queued sync tasks", value: "\(model.syncTasks.count)")
                StatRow(title: "Static assets", value: "\(model.staticAssets.count)")
            }

            Section("Cloudflare") {
                TextField("https://kiokun.pages.dev", text: $cloudflareBaseURL)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .accessibilityIdentifier("settings.cloudflareBaseURL")
                Button {
                    beginNativeSignIn()
                } label: {
                    if authInProgress {
                        Label("Signing in...", systemImage: "person.crop.circle.badge.clock")
                    } else {
                        Label("Sign in with Google", systemImage: "person.crop.circle.badge.checkmark")
                    }
                }
                .disabled(authInProgress || cloudflareBaseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("settings.signInGoogle")

                VStack(alignment: .leading, spacing: 6) {
                    Text("Better Auth cookie")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    CredentialCookieEditor(text: $cloudflareSessionCookie)
                        .frame(minHeight: 44, maxHeight: 72)
                        .privacySensitive()
                }
                VStack(alignment: .leading, spacing: 8) {
                    Button {
                        saveCloudflareSessionCookie()
                    } label: {
                        Label("Save credential", systemImage: "key")
                    }
                    .accessibilityIdentifier("settings.saveCloudflareCookie")

                    Button {
                        pasteCloudflareSessionCookie()
                    } label: {
                        Label("Paste", systemImage: "doc.on.clipboard")
                    }
                    .accessibilityIdentifier("settings.pasteCloudflareCookie")

                    Button(role: .destructive) {
                        clearCloudflareSessionCookie()
                    } label: {
                        Label("Clear", systemImage: "trash")
                    }
                    .disabled(cloudflareSessionCookie.isEmpty)
                    .accessibilityIdentifier("settings.clearCloudflareCookie")
                }
                if !credentialStatus.isEmpty {
                    Text(credentialStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("settings.credentialStatus")
                }
                HStack {
                    Label(model.isOnline ? "Online" : "Offline", systemImage: model.isOnline ? "wifi" : "wifi.slash")
                    Spacer()
                    if model.isSyncing {
                        ProgressView()
                    }
                }
                Button {
                    Task { await model.syncNow() }
                } label: {
                    Label("Sync now", systemImage: "arrow.triangle.2.circlepath")
                }
                .disabled(model.isSyncing)
                .accessibilityIdentifier("settings.syncNow")
                Text(model.statusMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("settings.syncStatus")
            }

            Section("Pending Tasks") {
                ForEach(model.syncTasks) { task in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(task.entity).\(task.operation)")
                            .font(.headline)
                        Text(task.entityId)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if task.attempts > 0 {
                            Text("Attempts: \(task.attempts)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if !task.lastError.isEmpty {
                            Text(task.lastError)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .onAppear {
            loadCloudflareSessionCookie()
        }
    }

    private func loadCloudflareSessionCookie() {
        do {
            cloudflareSessionCookie = try SecureCredentialStore.string(account: SecureCredentialStore.cloudflareSessionCookieAccount)
            if cloudflareSessionCookie.isEmpty,
               let legacy = UserDefaults.standard.string(forKey: "cloudflareSessionCookie")?.trimmingCharacters(in: .whitespacesAndNewlines),
               !legacy.isEmpty {
                try SecureCredentialStore.setString(legacy, account: SecureCredentialStore.cloudflareSessionCookieAccount)
                UserDefaults.standard.removeObject(forKey: "cloudflareSessionCookie")
                cloudflareSessionCookie = legacy
                credentialStatus = "Credential moved to Keychain."
            }
        } catch {
            credentialStatus = "Could not load credential: \(error.localizedDescription)"
        }
    }

    private func beginNativeSignIn() {
        guard !authInProgress else { return }
        authInProgress = true
        credentialStatus = "Opening Google sign-in..."
        let state = UUID().uuidString
        let coordinator = NativeAuthSessionCoordinator()
        authCoordinator = coordinator

        Task { @MainActor in
            defer {
                authInProgress = false
                authCoordinator = nil
            }
            do {
                if let mockCookie = ProcessInfo.processInfo.environment["KIOKUN_UI_TEST_AUTH_COOKIE"]?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !mockCookie.isEmpty {
                    try SecureCredentialStore.setString(mockCookie, account: SecureCredentialStore.cloudflareSessionCookieAccount)
                    cloudflareSessionCookie = try SecureCredentialStore.string(account: SecureCredentialStore.cloudflareSessionCookieAccount)
                    credentialStatus = "Signed in. Credential saved to Keychain."
                    return
                }
                let authorizationURL = try await NativeAuthBridge.authorizationURL(baseURL: cloudflareBaseURL, state: state)
                let cookie = try await coordinator.authenticate(authorizationURL: authorizationURL, expectedState: state)
                try SecureCredentialStore.setString(cookie, account: SecureCredentialStore.cloudflareSessionCookieAccount)
                cloudflareSessionCookie = try SecureCredentialStore.string(account: SecureCredentialStore.cloudflareSessionCookieAccount)
                credentialStatus = "Signed in. Credential saved to Keychain."
            } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
                credentialStatus = "Sign-in canceled."
            } catch {
                credentialStatus = "Could not sign in: \(error.localizedDescription)"
            }
        }
    }

    private func saveCloudflareSessionCookie() {
        do {
            let draft = CredentialCookieTextView.activeText ?? cloudflareSessionCookie
            try SecureCredentialStore.setString(draft, account: SecureCredentialStore.cloudflareSessionCookieAccount)
            UserDefaults.standard.removeObject(forKey: "cloudflareSessionCookie")
            cloudflareSessionCookie = try SecureCredentialStore.string(account: SecureCredentialStore.cloudflareSessionCookieAccount)
            credentialStatus = cloudflareSessionCookie.isEmpty ? "Credential cleared." : "Credential saved to Keychain."
        } catch {
            credentialStatus = "Could not save credential: \(error.localizedDescription)"
        }
    }

    private func pasteCloudflareSessionCookie() {
        let pasted = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !pasted.isEmpty else {
            credentialStatus = "Clipboard is empty."
            return
        }
        cloudflareSessionCookie = pasted
        credentialStatus = "Credential pasted."
    }

    private func clearCloudflareSessionCookie() {
        do {
            try SecureCredentialStore.delete(account: SecureCredentialStore.cloudflareSessionCookieAccount)
            UserDefaults.standard.removeObject(forKey: "cloudflareSessionCookie")
            cloudflareSessionCookie = ""
            credentialStatus = "Credential cleared."
        } catch {
            credentialStatus = "Could not clear credential: \(error.localizedDescription)"
        }
    }
}

enum FlowRowAlignment {
    case leading
    case center
}

private struct WrappingFlowLayout: Layout {
    var horizontalSpacing: CGFloat = 8
    var verticalSpacing: CGFloat = 8
    var rowAlignment: FlowRowAlignment = .leading

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrangedFrames(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let arrangement = arrangedFrames(
            proposal: ProposedViewSize(width: bounds.width, height: proposal.height),
            subviews: subviews
        )
        for index in subviews.indices {
            let frame = arrangement.frames[index]
            subviews[index].place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func arrangedFrames(proposal: ProposedViewSize, subviews: Subviews) -> (frames: [CGRect], size: CGSize) {
        let maxWidth = max(0, proposal.width ?? CGFloat.greatestFiniteMagnitude)
        var frames = Array(repeating: CGRect.zero, count: subviews.count)
        var rowStart = 0
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var x: CGFloat = 0
        var y: CGFloat = 0
        var widestRow: CGFloat = 0

        func finishRow(upTo endIndex: Int) {
            guard endIndex > rowStart else { return }
            let offset: CGFloat
            switch rowAlignment {
            case .leading:
                offset = 0
            case .center:
                offset = max(0, (maxWidth - rowWidth) / 2)
            }
            for index in rowStart..<endIndex {
                frames[index].origin.x += offset
            }
            widestRow = max(widestRow, rowWidth)
            y += rowHeight + verticalSpacing
            rowStart = endIndex
            rowWidth = 0
            rowHeight = 0
            x = 0
        }

        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let spacing = x == 0 ? CGFloat.zero : horizontalSpacing
            if x > 0, x + spacing + size.width > maxWidth {
                finishRow(upTo: index)
            }

            let nextX = x == 0 ? CGFloat.zero : x + horizontalSpacing
            frames[index] = CGRect(origin: CGPoint(x: nextX, y: y), size: size)
            x = nextX + size.width
            rowWidth = x
            rowHeight = max(rowHeight, size.height)
        }

        finishRow(upTo: subviews.count)
        let height = subviews.isEmpty ? 0 : max(0, y - verticalSpacing)
        let width = proposal.width ?? widestRow
        return (frames, CGSize(width: width, height: height))
    }
}

struct FlowLayout<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let items: Data
    var alignment: FlowRowAlignment
    let content: (Data.Element) -> Content

    init(items: Data, alignment: FlowRowAlignment = .leading, @ViewBuilder content: @escaping (Data.Element) -> Content) {
        self.items = items
        self.alignment = alignment
        self.content = content
    }

    var body: some View {
        WrappingFlowLayout(horizontalSpacing: 8, verticalSpacing: 8, rowAlignment: alignment) {
            ForEach(Array(items), id: \.self) { item in
                content(item)
            }
        }
    }
}
