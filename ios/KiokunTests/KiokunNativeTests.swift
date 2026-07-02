import XCTest
import UIKit
@testable import Kiokun

final class KiokunNativeTests: XCTestCase {
    private var temporaryURLs: [URL] = []

    override func tearDownWithError() throws {
        for url in temporaryURLs {
            try? FileManager.default.removeItem(at: url)
        }
        temporaryURLs.removeAll()
        try super.tearDownWithError()
    }

    func testBundledOfflineFixtureSupportsSearchLookupAndGame() throws {
        let db = try openFixtureDatabase()

        let results = try db.search(query: "hillock", language: .all)
        XCTAssertTrue(results.contains(where: { $0.word == "㐀" }))

        let record = try XCTUnwrap(db.lookup(word: "88"))
        XCTAssertEqual(record.key, "88")
        XCTAssertTrue(!record.allSections.isEmpty || !record.characters.isEmpty || !record.japaneseNames.isEmpty)

        let exercise = try XCTUnwrap(db.loadGameExercise())
        XCTAssertFalse(exercise.english.isEmpty)
        XCTAssertFalse(exercise.exercises.isEmpty)
        XCTAssertTrue(exercise.exercises.values.allSatisfy { !$0.tokens.isEmpty && !$0.tiles.isEmpty })
    }

    func testBundledGamePackIncludesEveryManifestChunkOffline() throws {
        let db = try openFixtureDatabase()
        let manifestText = try XCTUnwrap(db.staticAssetText(path: "game_unified/manifest.json"))
        let manifestData = try XCTUnwrap(manifestText.data(using: .utf8))
        let manifest = try XCTUnwrap(JSONSerialization.jsonObject(with: manifestData) as? [String: Any])
        let chunkCount = try XCTUnwrap(manifest["chunks"] as? Int)
        let chunkSize = try XCTUnwrap(manifest["chunk_size"] as? Int)

        let chunks = try db.staticAssetPaths(prefix: "game_unified/chunks/")
        XCTAssertEqual(chunks.count, chunkCount)
        XCTAssertEqual(chunkCount, 217)

        let finalExerciseId = (chunkCount - 1) * chunkSize
        let finalExercise = try XCTUnwrap(db.loadGameExercise(id: finalExerciseId))
        XCTAssertFalse(finalExercise.english.isEmpty)
        XCTAssertFalse(finalExercise.exercises.isEmpty)
    }

    func testCustomWordIsLocalFirstAndLookupable() throws {
        let db = try openEmptyDatabase()
        try db.upsertCustomWord(CustomWordDraft(
            word: "推し活",
            language: .ja,
            reading: "おしかつ",
            definitions: "fan activities\nsupporting a favorite performer",
            notes: "Created offline"
        ))

        let record = try XCTUnwrap(db.lookup(word: "推し活"))
        XCTAssertEqual(record.key, "推し活")
        XCTAssertEqual(record.japanese.first?.reading, "おしかつ")
        XCTAssertEqual(record.japanese.first?.definitions.count, 2)

        let queued = try db.listSyncTasks()
        XCTAssertEqual(queued.count, 1)
        XCTAssertEqual(queued.first?.entity, "customWord")
    }

    func testGameDictionaryLookupSummaryUsesOfflineGlossesAndDemotesNameSenses() throws {
        let db = try openEmptyDatabase()
        try db.upsertCustomWord(CustomWordDraft(
            word: "成",
            language: .zh,
            reading: "chéng",
            definitions: "surname Cheng\nto become\nto complete",
            notes: ""
        ))

        let resolved = try XCTUnwrap(db.lookupResolved(word: "成"))
        let summary = try XCTUnwrap(GameDictionaryLookupSummary(
            resolved: resolved,
            preferredLanguage: .zh,
            lookupWord: "成"
        ))

        XCTAssertEqual(summary.language, .zh)
        XCTAssertEqual(summary.lookupWord, "成")
        XCTAssertEqual(summary.resolvedWord, "成")
        XCTAssertEqual(summary.headword, "成")
        XCTAssertEqual(summary.reading, "chéng")
        XCTAssertEqual(summary.speechText, "成")
        XCTAssertEqual(Array(summary.definitions.prefix(3)), ["to become", "to complete", "surname Cheng"])
    }

    func testNativeSentenceTokenizerUsesLocalDictionaryGreedily() throws {
        let db = try openEmptyDatabase()
        try db.upsertCustomWord(CustomWordDraft(
            word: "日本語",
            language: .ja,
            reading: "にほんご",
            definitions: "Japanese language",
            notes: ""
        ))
        try db.upsertCustomWord(CustomWordDraft(
            word: "話す",
            language: .ja,
            reading: "はなす",
            definitions: "to speak",
            notes: ""
        ))

        let tokens = NativeSentenceTokenizer.tokenize("日本語を話す。", language: .ja, db: db)
        XCTAssertEqual(tokens.map(\.text), ["日本語", "を", "話す", "。"])
        XCTAssertEqual(tokens.filter(\.isWord).map(\.lookupText), ["日本語", "を", "話す"])
        XCTAssertEqual(tokens.first?.reading, "にほんご")
    }

    func testNativeSentenceTokenizerPreservesInflectedTokensForOfflineLookup() throws {
        let db = try openEmptyDatabase()
        try seedDictionaryEntry(db, key: "食べる", json: """
        {
          "key": "食べる",
          "japanese_words": [
            {
              "kanji": [{"text": "食べる", "common": true, "tags": []}],
              "kana": [{"text": "たべる", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "to eat"}], "partOfSpeech": ["v1"]}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "먹다", json: """
        {
          "key": "먹다",
          "korean_words": [
            {
              "hangul": "먹다",
              "hanja": "",
              "pos": "동사",
              "definitions": [{"text": "to eat"}]
            }
          ]
        }
        """)

        let japanese = NativeSentenceTokenizer.tokenize("食べました。", language: .ja, db: db)
        XCTAssertEqual(japanese.map(\.text), ["食べました", "。"])
        let japaneseLookup = try XCTUnwrap(db.lookupResolved(word: japanese.first?.lookupText ?? ""))
        XCTAssertEqual(japaneseLookup.record.key, "食べる")
        XCTAssertEqual(japaneseLookup.inflection?.conjugationInfo, "polite past")

        let korean = NativeSentenceTokenizer.tokenize("먹었어요.", language: .ko, db: db)
        XCTAssertEqual(korean.map(\.text), ["먹었어요", "."])
        let koreanLookup = try XCTUnwrap(db.lookupResolved(word: korean.first?.lookupText ?? ""))
        XCTAssertEqual(koreanLookup.record.key, "먹다")
        XCTAssertEqual(koreanLookup.inflection?.conjugationInfo, "past+polite")
    }

    func testSentenceHeuristicsDetectPastedSentencesWithoutHijackingSingleWords() {
        XCTAssertTrue(NativeSentenceHeuristics.isSentenceLike("日本語を勉強しています"))
        XCTAssertTrue(NativeSentenceHeuristics.isSentenceLike("我今天很开心"))
        XCTAssertTrue(NativeSentenceHeuristics.isSentenceLike("저는 한국어를 공부합니다"))

        XCTAssertFalse(NativeSentenceHeuristics.isSentenceLike("食べました"))
        XCTAssertFalse(NativeSentenceHeuristics.isSentenceLike("約束"))
        XCTAssertFalse(NativeSentenceHeuristics.isSentenceLike("語"))

        XCTAssertEqual(NativeSentenceHeuristics.inferredLanguage(for: "日本語を勉強しています", selected: .all), .ja)
        XCTAssertEqual(NativeSentenceHeuristics.inferredLanguage(for: "我今天很开心", selected: .all), .zh)
        XCTAssertEqual(NativeSentenceHeuristics.inferredLanguage(for: "저는 한국어를 공부합니다", selected: .all), .ko)
        XCTAssertEqual(NativeSentenceHeuristics.inferredLanguage(for: "我今天很开心", selected: .ja), .ja)
    }

    func testEntryHomophoneResolverMatchesWebJapaneseWordBehavior() throws {
        let db = try openEmptyDatabase()
        try seedDictionaryEntry(db, key: "交渉", json: """
        {
          "key": "交渉",
          "japanese_words": [
            {
              "id": "jp-homophone",
              "kanji": [{"text": "交渉", "common": true, "tags": []}],
              "kana": [{"text": "こうしょう", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "negotiation"}], "partOfSpeech": ["n"]}]
            }
          ]
        }
        """)
        try db.run("""
        INSERT INTO dictionary_search (word, language, definition, pronunciation, reading_search, is_common)
        VALUES
          ('交渉', 'japanese', 'negotiation', 'こうしょう', 'koushou', 1),
          ('こうしょう', 'japanese', 'reading spelling', 'こうしょう', 'koushou', 0),
          ('公称', 'japanese', 'public name; nominal', 'こうしょう', 'koushou', 0),
          ('高尚', 'japanese', 'noble; refined', 'こうしょう', 'koushou', 1)
        """)

        let record = try XCTUnwrap(db.lookup(word: "交渉"))
        let groups = try JapaneseEntryHomophoneResolver.groups(for: record, currentWord: "交渉", db: db)

        XCTAssertEqual(groups.map(\.reading), ["こうしょう"])
        XCTAssertEqual(groups.first?.words.map(\.word), ["高尚", "公称"])
        XCTAssertFalse(groups.first?.words.contains { $0.word == "交渉" } ?? true)
        XCTAssertFalse(groups.first?.words.contains { $0.word == "こうしょう" } ?? true)
    }

    func testArtifactImagesPersistLocallyAndQueueCompressedUpload() throws {
        let db = try openEmptyDatabase()
        try db.createArtifact(ArtifactDraft(
            title: "Station Poster",
            description: "Photo-heavy artifact",
            language: .ja,
            type: "sign",
            isPublic: false
        ))
        let artifact = try XCTUnwrap(try db.listArtifacts().first)
        let imageData = try makeTestJPEG()

        try db.addArtifactImage(artifactId: artifact.id, imageData: imageData)

        let images = try db.listArtifactImages(artifactId: artifact.id)
        XCTAssertEqual(images.count, 1)
        let image = try XCTUnwrap(images.first)
        XCTAssertTrue(FileManager.default.fileExists(atPath: image.imagePath))
        XCTAssertEqual(try db.listArtifacts().first?.thumbnailPath, image.imagePath)

        let imageTask = try XCTUnwrap(try db.listSyncTasks().first { $0.entity == "artifactImage" })
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(imageTask.payload.utf8)) as? [String: Any])
        XCTAssertEqual(payload["id"] as? String, image.id)
        XCTAssertEqual(payload["artifactId"] as? String, artifact.id)
        XCTAssertEqual(payload["contentType"] as? String, "image/jpeg")
        let upload = try XCTUnwrap(payload["imageDataBase64"] as? String)
        XCTAssertLessThanOrEqual(Data(base64Encoded: upload)?.count ?? Int.max, 5 * 1024 * 1024)
    }

    func testNoteImagesPersistLocallyAndQueueCompressedUploadInsideMarkdown() throws {
        let db = try openEmptyDatabase()
        let imageData = try makeTestJPEG()

        let markdown = try db.storeNoteImage(character: "語", imageData: imageData)
        let marker = try XCTUnwrap(LocalDatabase.localNoteImageMarkers(in: markdown).first)
        let imageId = try XCTUnwrap(LocalDatabase.noteImageId(from: marker))
        let localURL = try XCTUnwrap(db.localNoteImageURL(id: imageId))
        XCTAssertTrue(FileManager.default.fileExists(atPath: localURL.path))

        try db.upsertNote(character: "語", text: "Subway note\n\n\(markdown)")

        let noteTask = try XCTUnwrap(try db.listSyncTasks().first { $0.entity == "note" })
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(noteTask.payload.utf8)) as? [String: Any])
        XCTAssertEqual(payload["character"] as? String, "語")
        XCTAssertEqual(payload["noteText"] as? String, "Subway note\n\n\(markdown)")

        let noteImages = try XCTUnwrap(payload["noteImages"] as? [[String: Any]])
        XCTAssertEqual(noteImages.count, 1)
        XCTAssertEqual(noteImages.first?["id"] as? String, imageId)
        XCTAssertEqual(noteImages.first?["marker"] as? String, marker)
        XCTAssertEqual(noteImages.first?["contentType"] as? String, "image/jpeg")
        let upload = try XCTUnwrap(noteImages.first?["imageDataBase64"] as? String)
        XCTAssertLessThanOrEqual(Data(base64Encoded: upload)?.count ?? Int.max, 5 * 1024 * 1024)
    }

    func testNoteMarkdownParserSplitsImageBlocksFromMarkdownText() throws {
        let blocks = NoteMarkdownParser.blocks(from: "first **line**\n\n![Alt text](kiokun-note-image://image-1)\n\n_after_")
        XCTAssertEqual(blocks.count, 3)

        if case .markdown(let text) = blocks[0].content {
            XCTAssertTrue(text.contains("first **line**"))
        } else {
            XCTFail("Expected leading markdown block")
        }

        if case .image(let alt, let url) = blocks[1].content {
            XCTAssertEqual(alt, "Alt text")
            XCTAssertEqual(url, "kiokun-note-image://image-1")
        } else {
            XCTFail("Expected image block")
        }

        if case .markdown(let text) = blocks[2].content {
            XCTAssertTrue(text.contains("_after_"))
        } else {
            XCTFail("Expected trailing markdown block")
        }
    }

    func testArtifactMentionsFindOfflineSentencesByWord() throws {
        let db = try openEmptyDatabase()
        try db.createArtifact(ArtifactDraft(
            title: "Platform Sign",
            description: "Local artifact mention test",
            language: .ja,
            type: "sign",
            isPublic: false
        ))
        let artifact = try XCTUnwrap(try db.listArtifacts().first)
        try db.addArtifactSentence(artifactId: artifact.id, original: "出口はこちらです", translation: "The exit is this way")
        try db.addArtifactSentence(artifactId: artifact.id, original: "50%割引", translation: "50% discount")

        let exitMentions = try db.listArtifactMentions(word: "出口")
        XCTAssertEqual(exitMentions.count, 1)
        XCTAssertEqual(exitMentions.first?.artifact.title, "Platform Sign")
        XCTAssertEqual(exitMentions.first?.sentences.map(\.originalText), ["出口はこちらです"])

        let percentMentions = try db.listArtifactMentions(word: "50%")
        XCTAssertEqual(percentMentions.first?.sentences.map(\.originalText), ["50%割引"])
        XCTAssertTrue(try db.listArtifactMentions(word: "入口").isEmpty)
    }

    func testSecureCredentialStoreRoundTripsAndDeletes() throws {
        let account = "credential-test-\(UUID().uuidString)"
        defer { try? SecureCredentialStore.delete(account: account) }

        XCTAssertEqual(try SecureCredentialStore.string(account: account), "")
        try SecureCredentialStore.setString(" abc123\n", account: account)
        XCTAssertEqual(try SecureCredentialStore.string(account: account), "abc123")
        try SecureCredentialStore.setString("   ", account: account)
        XCTAssertEqual(try SecureCredentialStore.string(account: account), "")
    }

    func testNativeAuthBridgeBuildsBetterAuthSocialRequest() throws {
        let request = try NativeAuthBridge.socialSignInRequest(baseURL: "https://kiokun.example/app", state: "native-state")
        XCTAssertEqual(request.url?.absoluteString, "https://kiokun.example/api/auth/sign-in/social")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")

        let body = try XCTUnwrap(request.httpBody)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(object["provider"] as? String, "google")
        XCTAssertEqual(object["disableRedirect"] as? Bool, true)
        XCTAssertEqual(object["callbackURL"] as? String, "/api/mobile-auth/complete?state=native-state")
        XCTAssertEqual(object["errorCallbackURL"] as? String, "/api/mobile-auth/complete?state=native-state")
        XCTAssertEqual(object["newUserCallbackURL"] as? String, "/api/mobile-auth/complete?state=native-state")
    }

    func testNativeAuthBridgeParsesTransferredCookieCallback() throws {
        let url = try XCTUnwrap(URL(string: "kiokun://auth?state=native-state#cookie=better-auth.session_token%3Dabc%3B%20other%3D1"))
        let callback = try NativeAuthBridge.parseCallbackURL(url, expectedState: "native-state")
        XCTAssertEqual(callback.state, "native-state")
        XCTAssertEqual(callback.cookie, "better-auth.session_token=abc; other=1")

        XCTAssertThrowsError(try NativeAuthBridge.parseCallbackURL(url, expectedState: "other-state")) { error in
            XCTAssertEqual(error as? NativeAuthBridgeError, .callbackStateMismatch)
        }

        let errorURL = try XCTUnwrap(URL(string: "kiokun://auth?state=native-state&error=access_denied"))
        XCTAssertThrowsError(try NativeAuthBridge.parseCallbackURL(errorURL, expectedState: "native-state")) { error in
            XCTAssertEqual(error as? NativeAuthBridgeError, .callbackError("access_denied"))
        }
    }

    func testNativeSpeechLocalesMatchWebSpeakButtonLocales() {
        XCTAssertEqual(LanguageCode.zh.speechLocale, "zh-CN")
        XCTAssertEqual(LanguageCode.ja.speechLocale, "ja-JP")
        XCTAssertEqual(LanguageCode.ko.speechLocale, "ko-KR")
    }

    func testHandwritingRecognitionContractMatchesWebProxy() throws {
        let stroke = HandwritingStroke(x: [12, 48], y: [20, 64], t: [0, 120])
        let body = try HandwritingRecognitionClient.requestBody(strokes: [stroke], language: .zh)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(object["language"] as? String, "zh")

        let encodedStrokes = try XCTUnwrap(object["strokes"] as? [[String: Any]])
        let encodedStroke = try XCTUnwrap(encodedStrokes.first)
        let xValues = try XCTUnwrap(encodedStroke["x"] as? [NSNumber]).map(\.doubleValue)
        let yValues = try XCTUnwrap(encodedStroke["y"] as? [NSNumber]).map(\.doubleValue)
        let tValues = try XCTUnwrap(encodedStroke["t"] as? [NSNumber]).map(\.doubleValue)
        XCTAssertEqual(xValues, [12, 48])
        XCTAssertEqual(yValues, [20, 64])
        XCTAssertEqual(tValues, [0, 120])

        let proxyData = try XCTUnwrap(#"{"candidates":["語","学"]}"#.data(using: .utf8))
        XCTAssertEqual(try HandwritingRecognitionClient.parseCandidates(from: proxyData), ["語", "学"])

        let googleData = try XCTUnwrap(#"["SUCCESS",[["",["語","学"],[],{}]]]"#.data(using: .utf8))
        XCTAssertEqual(try HandwritingRecognitionClient.parseCandidates(from: googleData), ["語", "学"])

        let url = try HandwritingRecognitionClient.recognitionURL(baseURL: "https://kiokun.example/dev")
        XCTAssertEqual(url.absoluteString, "https://kiokun.example/api/handwriting")
    }

    func testJapaneseConjugationTablesMatchWebGeneratedForms() throws {
        let ichidan = JapaneseConjugator.conjugate("食べる", type: .v1)
        XCTAssertEqual(ichidan.verbType.displayLabel, "Ichidan verb")
        XCTAssertEqual(form(in: ichidan, "Polite"), "食べます")
        XCTAssertEqual(form(in: ichidan, "Negative"), "食べない")
        XCTAssertEqual(form(in: ichidan, "Causative Passive"), "食べさせられる")

        let godan = JapaneseConjugator.conjugate("書く", type: .v5k)
        XCTAssertEqual(form(in: godan, "Te-form"), "書いて")
        XCTAssertEqual(form(in: godan, "Past"), "書いた")
        XCTAssertEqual(form(in: godan, "Volitional"), "書こう")
        XCTAssertEqual(form(in: godan, "Potential"), "書ける")

        let ikuSpecial = JapaneseConjugator.conjugate("行く", type: .v5kS)
        XCTAssertEqual(form(in: ikuSpecial, "Te-form"), "行って")
        XCTAssertEqual(form(in: ikuSpecial, "Past"), "行った")

        let suru = JapaneseConjugator.conjugate("勉強する", type: .vsI)
        XCTAssertEqual(form(in: suru, "Polite"), "勉強します")
        XCTAssertEqual(form(in: suru, "Potential"), "勉強できる")

        let kuru = JapaneseConjugator.conjugate("来る", type: .vk)
        XCTAssertEqual(form(in: kuru, "Polite"), "来ます")
        XCTAssertEqual(form(in: kuru, "Negative"), "来ない")

        let section = WordSection(language: .ja, headword: "話す", reading: "はなす", definitions: ["to speak"], tags: ["v5s", "common"])
        let table = try XCTUnwrap(JapaneseConjugator.table(for: section))
        XCTAssertEqual(table.verbType, .v5s)
        XCTAssertEqual(form(in: table, "Te-form"), "話して")
    }

    func testJapaneseDeinflectionResolvesOfflineDictionaryEntries() throws {
        let db = try openEmptyDatabase()
        try seedDictionaryEntry(db, key: "食べる", json: """
        {
          "key": "食べる",
          "japanese_words": [
            {
              "kanji": [{"text": "食べる", "common": true, "tags": []}],
              "kana": [{"text": "たべる", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "to eat"}], "partOfSpeech": ["v1"]}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "書く", json: """
        {
          "key": "書く",
          "japanese_words": [
            {
              "kanji": [{"text": "書く", "common": true, "tags": []}],
              "kana": [{"text": "かく", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "to write"}], "partOfSpeech": ["v5k"]}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "読む", json: """
        {
          "key": "読む",
          "japanese_words": [
            {
              "kanji": [{"text": "読む", "common": true, "tags": []}],
              "kana": [{"text": "よむ", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "to read"}], "partOfSpeech": ["v5m"]}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "描く", json: """
        {
          "key": "描く",
          "japanese_words": [
            {
              "kanji": [{"text": "描く", "common": true, "tags": []}],
              "kana": [{"text": "かく", "common": false, "tags": []}],
              "sense": [{"gloss": [{"text": "to draw"}], "partOfSpeech": ["v5k"]}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "高い", json: """
        {
          "key": "高い",
          "japanese_words": [
            {
              "kanji": [{"text": "高い", "common": true, "tags": []}],
              "kana": [{"text": "たかい", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "high; expensive"}], "partOfSpeech": ["adj-i"]}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "かく", json: """
        {
          "key": "かく",
          "japanese_words": [
            {
              "kanji": [],
              "kana": [{"text": "かく", "common": false, "tags": []}],
              "sense": [{"gloss": [{"text": "stroke order"}], "partOfSpeech": ["n"]}]
            }
          ]
        }
        """)
        try db.run("""
        INSERT INTO dictionary_search (word, language, definition, pronunciation, reading_search, is_common)
        VALUES
          ('食べる', 'japanese', 'to eat', 'たべる', 'taberu', 1),
          ('書く', 'japanese', 'to write', 'かく', 'kaku', 1),
          ('描く', 'japanese', 'to draw', 'かく', 'kaku', 0),
          ('読む', 'japanese', 'to read', 'よむ', 'yomu', 1)
        """)

        let politePast = try XCTUnwrap(db.lookupResolved(word: "食べました"))
        XCTAssertEqual(politePast.record.key, "食べる")
        XCTAssertEqual(politePast.inflection?.original, "食べました")
        XCTAssertEqual(politePast.inflection?.conjugationInfo, "polite past")

        let romajiPolitePast = try XCTUnwrap(db.lookupResolved(word: "tabemashita"))
        XCTAssertEqual(romajiPolitePast.record.key, "食べる")
        XCTAssertEqual(romajiPolitePast.inflection?.conjugationInfo, "polite past")

        let teForm = try XCTUnwrap(db.lookupResolved(word: "書いて"))
        XCTAssertEqual(teForm.record.key, "書く")
        XCTAssertEqual(teForm.inflection?.conjugationInfo, "-te")

        let godanPotential = try XCTUnwrap(db.lookupResolved(word: "書ける"))
        XCTAssertEqual(godanPotential.record.key, "書く")
        XCTAssertEqual(godanPotential.inflection?.conjugationInfo, "potential")

        let negativeTe = try XCTUnwrap(db.lookupResolved(word: "食べないで"))
        XCTAssertEqual(negativeTe.record.key, "食べる")
        XCTAssertEqual(negativeTe.inflection?.conjugationInfo, "negative -te")

        let chau = try XCTUnwrap(db.lookupResolved(word: "読んじゃう"))
        XCTAssertEqual(chau.record.key, "読む")
        XCTAssertEqual(chau.inflection?.conjugationInfo, "-chau")

        let adjectivePoliteNegative = try XCTUnwrap(db.lookupResolved(word: "高くありません"))
        XCTAssertEqual(adjectivePoliteNegative.record.key, "高い")
        XCTAssertEqual(adjectivePoliteNegative.inflection?.conjugationInfo, "polite negative")

        let readingFallback = try XCTUnwrap(db.lookupResolved(word: "かいた"))
        XCTAssertEqual(readingFallback.record.key, "書く")
        XCTAssertEqual(readingFallback.inflection?.conjugationInfo, "past")

        let alternatives = try db.inflectionAlternatives(word: "かいた")
        XCTAssertEqual(alternatives.map(\.dictionaryForm), ["書く", "描く"])

        let searchResult = try XCTUnwrap(db.deinflectedSearchResult(query: "食べました"))
        XCTAssertEqual(searchResult.word, "食べました")
        XCTAssertEqual(searchResult.resolvedWord, "食べる")
        XCTAssertTrue(searchResult.definitions.first?.contains("食べました → 食べる") == true)

        let ambiguousSearchResult = try XCTUnwrap(db.deinflectedSearchResult(query: "かいた"))
        XCTAssertEqual(ambiguousSearchResult.resolvedWord, "書く")
        XCTAssertEqual(ambiguousSearchResult.alternativeInflections.map(\.dictionaryForm), ["描く"])
    }

    func testKoreanDeinflectionResolvesOfflineDictionaryEntries() throws {
        let db = try openEmptyDatabase()
        try seedDictionaryEntry(db, key: "먹다", json: """
        {
          "key": "먹다",
          "korean_words": [
            {
              "hangul": "먹다",
              "hanja": "",
              "pos": "동사",
              "definitions": [{"text": "to eat"}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "공부하다", json: """
        {
          "key": "공부하다",
          "korean_words": [
            {
              "hangul": "공부하다",
              "hanja": "工夫하다",
              "pos": "동사",
              "definitions": [{"text": "to study"}]
            }
          ]
        }
        """)
        try seedDictionaryEntry(db, key: "나", json: """
        {
          "key": "나",
          "korean_words": [
            {
              "hangul": "나",
              "hanja": "",
              "pos": "대명사",
              "definitions": [{"text": "I; me"}]
            }
          ]
        }
        """)

        let pastPolite = try XCTUnwrap(db.lookupResolved(word: "먹었어요"))
        XCTAssertEqual(pastPolite.record.key, "먹다")
        XCTAssertEqual(pastPolite.inflection?.original, "먹었어요")
        XCTAssertEqual(pastPolite.inflection?.conjugationInfo, "past+polite")

        let hadaCompound = try XCTUnwrap(db.lookupResolved(word: "공부했어요"))
        XCTAssertEqual(hadaCompound.record.key, "공부하다")
        XCTAssertEqual(hadaCompound.inflection?.conjugationInfo, "past+polite")

        let subjectParticle = try XCTUnwrap(db.lookupResolved(word: "내가"))
        XCTAssertEqual(subjectParticle.record.key, "나")
        XCTAssertEqual(subjectParticle.inflection?.conjugationInfo, "subject")

        let searchResult = try XCTUnwrap(db.deinflectedSearchResult(query: "먹었어요", language: .ko))
        XCTAssertEqual(searchResult.word, "먹었어요")
        XCTAssertEqual(searchResult.language, "korean")
        XCTAssertEqual(searchResult.resolvedWord, "먹다")
        XCTAssertTrue(searchResult.definitions.first?.contains("먹었어요 → 먹다") == true)

        let searchResults = try db.search(query: "먹었어요", language: .all)
        XCTAssertTrue(searchResults.contains { $0.word == "먹었어요" && $0.resolvedWord == "먹다" })
    }

    func testDictionaryDecodeEnrichesComponentsAndSimilarCharacters() throws {
        let json = """
        {
          "key": "語",
          "chinese_char": {
            "char": "語",
            "gloss": "language",
            "components": [
              {"character": "言", "type": ["meaning"], "meaning": "words, speech"},
              {"character": "吾", "type": ["sound"], "meaning": "I, my, our", "pinyin": "wú", "hint": "phonetic cue"}
            ],
            "images": [
              {
                "source": "makemeahanzi",
                "data": {
                  "strokes": [
                    "M100 100 L300 100 L300 180 L100 180 Z",
                    "M120 260 L320 260 L320 340 L120 340 Z"
                  ],
                  "matches": [[0], [1]]
                }
              }
            ],
            "ids": "⿰言吾",
            "pinyinFrequencies": [{"pinyin": "yǔ", "count": 261}],
            "strokeCount": 14
          },
          "contained_in_japanese": [
            {"w": "英語", "jp": "えいご", "d": "English", "c": true, "fr": 2934}
          ]
        }
        """
        let componentUses: ComponentUseIndex = [
            "言": [
                "meaning": ComponentUseBucket(chars: ["語", "信", "詰"], count: 3, verified: 2)
            ],
            "吾": [
                "sound": ComponentUseBucket(chars: ["語", "悟"], count: 2, verified: 1)
            ],
            "語": [
                "meaning": ComponentUseBucket(chars: ["譯", "議"], count: 2, verified: 1),
                "sound": ComponentUseBucket(chars: ["悟"], count: 1, verified: 1)
            ]
        ]

        let record = try XCTUnwrap(LocalDatabase.decodeRecord(
            json: json,
            componentGlosses: [
                "言": "words",
                "吾": "I; me",
                "信": "trust",
                "詰": "to question",
                "悟": "understand"
            ],
            componentUses: componentUses
        ))

        let components = try XCTUnwrap(record.characters.first?.components)
        XCTAssertEqual(components.map(\.meaning), ["words", "I; me"])
        XCTAssertEqual(components.last?.roleLabel, "Phonetic component")
        XCTAssertEqual(components.last?.pinyin, "wú")
        XCTAssertEqual(components.last?.hint, "phonetic cue")
        XCTAssertEqual(components.map(\.componentIndex), [0, 1])
        XCTAssertEqual(record.characters.first?.strokeSet?.source, "makemeahanzi")
        XCTAssertEqual(record.characters.first?.strokeSet?.strokes.count, 2)
        XCTAssertEqual(record.characters.first?.strokeSet?.matches, [[0], [1]])
        XCTAssertEqual(record.characters.first?.componentUses.map(\.role), ["meaning", "sound"])
        XCTAssertEqual(record.characters.first?.componentUses.first?.chars, ["譯", "議"])
        XCTAssertEqual(record.characters.first?.componentUses.first?.verified, 1)
        XCTAssertEqual(record.containedInJapanese.first?.frequencyRank, 2934)
        XCTAssertEqual(record.similarCharacters.map(\.character), ["信", "悟", "詰"])
        XCTAssertEqual(record.similarCharacters.first?.gloss, "trust")
    }

    func testDictionaryDecodeKeepsEmbeddedJapaneseExamplesOffline() throws {
        let json = """
        {
          "key": "食べる",
          "japanese_words": [
            {
              "kanji": [{"text": "食べる", "common": true, "tags": []}],
              "kana": [{"text": "たべる", "common": true, "tags": []}],
              "sense": [
                {
                  "gloss": [{"text": "to eat"}],
                  "partOfSpeech": ["v1"],
                  "examples": [
                    {
                      "source": {"type": "tatoeba", "value": "193344"},
                      "text": "食べる",
                      "sentences": [
                        {"land": "jpn", "text": "もっと果物を食べるべきです。"},
                        {"land": "eng", "text": "You should eat more fruit."}
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
        """

        let record = try XCTUnwrap(LocalDatabase.decodeRecord(json: json))
        let example = try XCTUnwrap(record.japanese.first?.examples.first)
        XCTAssertEqual(example.text, "もっと果物を食べるべきです。")
        XCTAssertEqual(example.translation, "You should eat more fruit.")
        XCTAssertEqual(example.source, "tatoeba 193344")
    }

    func testDictionaryDecodeKeepsRichRendererMetadataOffline() throws {
        let labels = JapaneseLabelLookup.decode(json: """
        {
          "partOfSpeech": {"v1": "ichidan verb", "n": "noun"},
          "misc": {"uk": "usually kana"},
          "field": {"ling": "linguistics"},
          "dialect": {"ksb": "Kansai"},
          "tag": {"iK": "irregular kanji"},
          "glossType": {"figurative": "figurative"}
        }
        """)
        let json = """
        {
          "key": "語",
          "chinese_words": [
            {
              "_id": "zh-1",
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
              "id": "jp-1",
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
              "id": "ko-1",
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

        let record = try XCTUnwrap(LocalDatabase.decodeRecord(
            json: json,
            componentUses: [
                "語": [
                    "meaning": ComponentUseBucket(chars: ["譯", "議"], count: 2, verified: 1),
                    "sound": ComponentUseBucket(chars: ["悟"], count: 1, verified: 1)
                ]
            ],
            japaneseLabels: labels
        ))

        let chinese = try XCTUnwrap(record.chineseWordEntries.first)
        XCTAssertEqual(chinese.displayHeadword, "語 / 语")
        XCTAssertEqual(chinese.items.first?.jyutping, "jyu5")
        XCTAssertEqual(chinese.statistics?.movieWordRank, 42)

        let japanese = try XCTUnwrap(record.japaneseWordEntries.first)
        XCTAssertEqual(japanese.visibleKanji.first?.pitchAccents, [1])
        XCTAssertEqual(japanese.senses.first?.field, ["ling"])
        XCTAssertEqual(japanese.senses.first?.examples.first?.translation, "I speak Japanese.")
        XCTAssertEqual(record.japaneseLabels.label("n", category: .partOfSpeech), "noun")
        XCTAssertEqual(record.japaneseLabels.headwordInfoLabel("iK"), "irregular kanji")

        let korean = try XCTUnwrap(record.koreanWordEntries.first)
        XCTAssertEqual(korean.definitions.first?.senseNumber, 1)
        XCTAssertEqual(korean.examples.first?.translation, "Korean language")
        XCTAssertEqual(korean.flattenedSection().tags, ["noun", "sino_korean", "rank 77"])

        let character = try XCTUnwrap(record.characters.first)
        XCTAssertTrue(character.facts.contains { $0.label == "Codepoint" && $0.value == "U+8A9E" })
        XCTAssertEqual(character.components.last?.roleLabel, "Phonetic component")
        XCTAssertEqual(character.components.last?.pinyin, "wú")
        XCTAssertEqual(character.components.last?.hint, "phonetic cue")
        XCTAssertEqual(character.topWords.first?.word, "語言")
        XCTAssertEqual(character.variants.first?.character, "语")
        XCTAssertEqual(character.oldPronunciations.first?.oldChinese, "ŋaʔ")
        XCTAssertEqual(character.comments.first?.comment, "common phonetic series")
        XCTAssertEqual(character.images.first?.era, "Qin")
        XCTAssertEqual(character.images.first?.strokeSet?.strokes.count, 2)
        XCTAssertEqual(character.strokeSet?.source, "makemeahanzi")
        XCTAssertEqual(character.strokeSet?.strokes.count, 2)
        XCTAssertEqual(character.strokeSet?.matches, [[0], [1]])
        XCTAssertEqual(character.componentUses.map(\.role), ["meaning", "sound"])
        XCTAssertEqual(character.componentUses.first?.count, 2)
        XCTAssertEqual(character.componentUses.first?.verified, 1)

        let forms = CharacterFormSummary.forms(for: record)
        XCTAssertEqual(forms.map(\.form), ["語", "语"])
        let traditional = try XCTUnwrap(forms.first { $0.form == "語" })
        XCTAssertEqual(traditional.labels, ["Traditional", "Japanese", "Korean"])
        XCTAssertTrue(traditional.readings.contains("ご"))
        XCTAssertTrue(traditional.readings.contains("어 / eo"))
        XCTAssertTrue(traditional.tags.contains("HSK 3"))
        let simplified = try XCTUnwrap(forms.first { $0.form == "语" })
        XCTAssertEqual(simplified.labels, ["Simplified"])
    }

    func testLookupLoadsBundledJapaneseLabelsForNativeRenderer() throws {
        let db = try openEmptyDatabase()
        try seedStaticAsset(
            db,
            path: "japanese_labels.json",
            json: #"{"partOfSpeech":{"v1":"ichidan verb"},"misc":{"uk":"usually kana"},"tag":{"iK":"irregular kanji"}}"#
        )
        try seedDictionaryEntry(db, key: "食べる", json: """
        {
          "key": "食べる",
          "japanese_words": [
            {
              "id": "jp-label",
              "kanji": [{"text": "食べる", "common": true, "tags": ["iK"]}],
              "kana": [{"text": "たべる", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "to eat"}], "partOfSpeech": ["v1"], "misc": ["uk"]}]
            }
          ]
        }
        """)

        let record = try XCTUnwrap(db.lookup(word: "食べる"))
        XCTAssertEqual(record.japaneseLabels.label("v1", category: .partOfSpeech), "ichidan verb")
        XCTAssertEqual(record.japaneseLabels.label("uk", category: .misc), "usually kana")
        XCTAssertEqual(record.japaneseLabels.headwordInfoLabel("iK"), "irregular kanji")
    }

    func testPhoneticSeriesUsesOfflineComponentAssetsAndDictionaryPinyin() throws {
        let db = try openEmptyDatabase()
        try seedStaticAsset(
            db,
            path: "game_data/component_uses.json",
            json: #"{"青":{"sound":{"chars":["清","情"],"count":2}}}"#
        )
        try seedStaticAsset(
            db,
            path: "game_data/component_glosses.json",
            json: #"{"青":"blue or green","清":"pure","情":"feelings"}"#
        )
        try seedDictionaryEntry(db, key: "清", json: """
        {
          "key": "清",
          "chinese_char": {
            "char": "清",
            "gloss": "clear",
            "pinyinFrequencies": [{"pinyin": "qīng", "count": 100}]
          }
        }
        """)

        XCTAssertEqual(try db.phoneticComponentGloss("青"), "blue or green")
        let series = try db.phoneticSeries(component: "青")
        XCTAssertEqual(series.map(\.character), ["清", "情"])
        XCTAssertEqual(series.first?.pinyin, ["qīng"])
        XCTAssertEqual(series.first?.gloss, "pure")
        XCTAssertEqual(series.last?.primaryReading, "none")

        let fallbackDB = try openEmptyDatabase()
        try seedDictionaryEntry(fallbackDB, key: "青", json: """
        {
          "key": "青",
          "chinese_char": {
            "char": "青",
            "gloss": "blue or green",
            "pinyinFrequencies": [{"pinyin": "qīng", "count": 100}]
          }
        }
        """)
        XCTAssertEqual(try fallbackDB.phoneticComponentGloss("青"), "blue or green")
    }

    func testStaticSentenceShardLookupMatchesWebIndexFormat() throws {
        let db = try openEmptyDatabase()
        try seedStaticAsset(
            db,
            path: "zh_sentences/idx/\(LocalDatabase.sentenceIndexShard(for: "你好")).json",
            json: #"{"你好":[[10,0],[10,1]]}"#
        )
        try seedStaticAsset(
            db,
            path: "zh_sentences/a.json",
            json: #"[["你好。","你好。","Hello.","nǐ hǎo 。"],["你好！","你好！","Hi!","nǐ hǎo ！"]]"#
        )
        try seedStaticAsset(
            db,
            path: "kr_sentences/idx/\(LocalDatabase.sentenceIndexShard(for: "안녕")).json",
            json: #"{"안녕":[[0,0]]}"#
        )
        try seedStaticAsset(
            db,
            path: "kr_sentences/0.json",
            json: #"[["안녕!","Hello!"]]"#
        )

        let chinese = try db.sentenceExamples(word: "你好", language: .zh)
        XCTAssertEqual(chinese.map(\.text), ["你好。", "你好！"])
        XCTAssertEqual(chinese.first?.translation, "Hello.")
        XCTAssertEqual(chinese.first?.reading, "nǐ hǎo 。")
        XCTAssertEqual(chinese.first?.source, "zh_sentences/a.json#0")

        let korean = try db.sentenceExamples(word: "韓", language: .ko, fallbackWords: ["안녕"])
        XCTAssertEqual(korean.first?.text, "안녕!")
        XCTAssertEqual(korean.first?.translation, "Hello!")
    }

    func testHomophoneParsersCoverOfflineLanguagesModesAndJapaneseFilters() throws {
        let db = try openFixtureDatabase()

        let japaneseWords = try db.homophoneGroups(language: .ja, mode: .words)
        XCTAssertGreaterThan(japaneseWords.count, 100)
        let kakehiki = try XCTUnwrap(japaneseWords.first { $0.reading == "かけひき" })
        XCTAssertTrue(kakehiki.entries.contains { $0.word == "駆け引き" && $0.accent == 2 && $0.isCommon })

        let japaneseCharacters = try db.homophoneGroups(language: .ja, mode: .characters)
        let kou = try XCTUnwrap(japaneseCharacters.first { $0.reading == "こう" })
        XCTAssertTrue(kou.entries.contains { $0.word == "紅" && $0.accent == 1 })

        let chineseWords = try db.homophoneGroups(language: .zh, mode: .words)
        XCTAssertTrue(chineseWords.contains { $0.displayReading.localizedCaseInsensitiveContains("yì") && $0.entries.contains { $0.word == "意义" } })

        let chineseCharacters = try db.homophoneGroups(language: .zh, mode: .characters)
        XCTAssertTrue(chineseCharacters.contains { $0.reading == "yì" && $0.entries.contains { $0.word == "亿" && $0.pinyin == "yì" } })

        let korean = try db.homophoneGroups(language: .ko, mode: .characters)
        let gi = try XCTUnwrap(korean.first { $0.reading == "기" })
        XCTAssertEqual(gi.mode, .words)
        XCTAssertTrue(gi.entries.contains { $0.word == "紀" && $0.hangul == "기" })

        XCTAssertEqual(LocalDatabase.romajiToHiragana("kakehiki"), "かけひき")
        XCTAssertEqual(LocalDatabase.countJapaneseMorae("かけひき"), 4)
    }

    func testFrequencyParserCoversBundledJapaneseAndChineseRows() throws {
        let db = try openFixtureDatabase()

        let japanese = try db.frequencyEntries(language: .ja)
        XCTAssertEqual(japanese.first?.rank, 3)
        XCTAssertEqual(japanese.first?.word, "に")
        XCTAssertEqual(japanese.first?.reading, "に")
        XCTAssertTrue(japanese.first?.isCommon == true)

        let chinese = try db.frequencyEntries(language: .zh)
        XCTAssertEqual(chinese.first?.rank, 1)
        XCTAssertEqual(chinese.first?.word, "的")
        XCTAssertEqual(chinese.first?.reading, "de")

        XCTAssertEqual(try db.frequencyEntries(language: .ko), [])
    }

    func testChineseCommonSearchFallsBackToBundledFrequencyRows() throws {
        let db = try openFixtureDatabase()

        let common = try db.search(query: "", language: .zh)
        XCTAssertEqual(common.first?.word, "的")
        XCTAssertEqual(common.first?.language, "chinese")
        XCTAssertEqual(common.first?.pronunciation, "de")
        XCTAssertTrue(common.first?.isCommon == true)
        XCTAssertGreaterThanOrEqual(common.count, 50)
    }

    func testDragonCharacterFormsFollowMainSiteOrderAndHydrateSiblingStrokes() throws {
        let db = try openFixtureDatabase()
        let dragon = try XCTUnwrap(db.lookup(word: "龍"))
        let forms = CharacterFormSummary.forms(for: dragon)

        XCTAssertEqual(Array(forms.map(\.form).prefix(3)), ["龍", "龙", "竜"])
        XCTAssertEqual(forms.first { $0.form == "龍" }?.labels.first, "Traditional")
        XCTAssertEqual(forms.first { $0.form == "龙" }?.labels.first, "Simplified")
        XCTAssertEqual(forms.first { $0.form == "竜" }?.labels.first, "Japanese")

        let simplified = try XCTUnwrap(db.lookup(word: "龙"))
        let simplifiedStrokeSet = try XCTUnwrap(simplified.characters.first { $0.form == "龙" }?.strokeSet)
        XCTAssertFalse(simplifiedStrokeSet.strokes.isEmpty)
    }

    func testReelParsersLoadBundledMetadataAndFullTranscripts() throws {
        let db = try openFixtureDatabase()

        let japanese = try db.reelVideos(language: .ja)
        XCTAssertGreaterThan(japanese.count, 100)
        let japaneseKnown = try XCTUnwrap(japanese.first { $0.videoId == "e77a9f2f-7582-4ab3-b516-4a74c9d1a395" })
        XCTAssertEqual(japaneseKnown.author, "@yukinoyukicha")
        XCTAssertFalse(japaneseKnown.thumbnail.isEmpty)

        let japaneseDetail = try XCTUnwrap(db.reelDetail(videoId: japaneseKnown.videoId, language: .ja))
        XCTAssertGreaterThan(japaneseDetail.transcript.count, 1)
        XCTAssertTrue(japaneseDetail.transcript.first?.sentence.contains("宮下") == true)
        XCTAssertTrue(japaneseDetail.transcript.first?.words.contains("宮下") == true)

        let chinese = try db.reelVideos(language: .zh)
        XCTAssertGreaterThan(chinese.count, 5)
        let chineseKnown = try XCTUnwrap(chinese.first { $0.videoId == "1df5c5f9-95b5-43aa-9a9d-f452af888eb5" })
        let chineseDetail = try XCTUnwrap(db.reelDetail(videoId: chineseKnown.videoId, language: .zh))
        XCTAssertTrue(chineseDetail.transcript.first?.sentence.contains("为什么") == true)
        XCTAssertTrue(chineseDetail.transcript.first?.words.contains("不是") == true)
    }

    func testReelOccurrenceLookupMatchesBundledWordIndexes() throws {
        let db = try openFixtureDatabase()

        let japaneseOccurrences = try db.reelOccurrences(word: "宮下", language: .ja)
        XCTAssertEqual(japaneseOccurrences.count, 1)
        XCTAssertEqual(japaneseOccurrences.first?.videoId, "e77a9f2f-7582-4ab3-b516-4a74c9d1a395")
        XCTAssertEqual(japaneseOccurrences.first?.video?.author, "@yukinoyukicha")
        XCTAssertTrue(japaneseOccurrences.first?.sentence.contains("宮下パーク") == true)

        let chineseOccurrences = try db.reelOccurrences(word: "不是", language: .zh)
        XCTAssertGreaterThanOrEqual(chineseOccurrences.count, 3)
        let chineseKnown = try XCTUnwrap(chineseOccurrences.first { $0.videoId == "1df5c5f9-95b5-43aa-9a9d-f452af888eb5" })
        XCTAssertTrue(chineseKnown.sentence.contains("为什么不是"))

        XCTAssertEqual(try db.reelOccurrences(word: "not-in-fixture", language: .ja), [])
    }

    func testLookupEnrichesJapanesePitchAccentFromOfflineShard() throws {
        let db = try openEmptyDatabase()
        try seedDictionaryEntry(db, key: "食べる", json: """
        {
          "key": "食べる",
          "japanese_words": [
            {
              "kanji": [{"text": "食べる", "common": true, "tags": []}],
              "kana": [{"text": "たべる", "common": true, "tags": []}],
              "sense": [{"gloss": [{"text": "to eat"}], "partOfSpeech": ["v1"]}]
            }
          ]
        }
        """)
        try seedStaticAsset(
            db,
            path: "pitch/\(LocalDatabase.sentenceIndexShard(for: "食べる")).json",
            json: #"{"食べる":{"たべる":2}}"#
        )

        let record = try XCTUnwrap(db.lookup(word: "食べる"))
        let pitch = try XCTUnwrap(record.japanese.first?.pitchAccent)
        XCTAssertEqual(pitch.accent, 2)
        XCTAssertEqual(pitch.morae, ["た", "べ", "る"])
        XCTAssertEqual(pitch.label, "中高")
    }

    func testReadingLookupFindsKanjiFormsOffline() throws {
        let db = try openEmptyDatabase()
        try db.run("""
        INSERT INTO dictionary_search (word, language, definition, pronunciation, reading_search, is_common)
        VALUES
          ('食べる', 'japanese', 'to eat', 'たべる', 'taberu', 1),
          ('たべる', 'japanese', 'to eat', 'たべる', 'taberu', 0),
          ('食べ物', 'japanese', 'food', 'たべもの', 'tabemono', 1)
        """)

        let hiraganaResults = try db.lookupReading(query: "たべる")
        XCTAssertEqual(hiraganaResults.map(\.word), ["食べる"])

        let katakanaResults = try db.lookupReading(query: "タベル")
        XCTAssertEqual(katakanaResults.map(\.word), ["食べる"])
    }

    func testSRSReviewSchedulingMatchesExpectedStateTransitions() {
        let card = StudyCard(
            id: "card-1",
            userId: "user-1",
            word: "食べる",
            language: .ja,
            easeFactor: 250,
            interval: 0,
            repetitions: 0,
            nextReview: Date(),
            lastReviewed: nil,
            createdAt: Date(),
            updatedAt: Date(),
            dirty: false
        )

        let again = LocalDatabase.calculateNextReview(card: card, rating: .again)
        XCTAssertEqual(again.interval, 0)
        XCTAssertEqual(again.repetitions, 0)
        XCTAssertLessThan(again.easeFactor, 250)

        let good = LocalDatabase.calculateNextReview(card: card, rating: .good)
        XCTAssertEqual(good.interval, 1)
        XCTAssertEqual(good.repetitions, 1)
        XCTAssertEqual(good.easeFactor, 250)
    }

    func testPullSyncAppliesRemoteRowsAndPreservesNewerDirtyLocalEdits() throws {
        let db = try openEmptyDatabase()
        let initialPayload = try decodePullPayload("""
        {
          "serverTime": 2000,
          "notes": [
            {"id":"note-1","character":"好","noteText":"server note","isAdmin":false,"createdAt":1000,"updatedAt":2000}
          ],
          "studyCards": [
            {"id":"card-1","word":"好","language":"zh","easeFactor":250,"interval":0,"repetitions":0,"nextReview":2000,"createdAt":1000,"updatedAt":2000}
          ],
          "customWords": [],
          "artifacts": [
            {"id":"artifact-1","title":"Sign","description":"Station sign","language":"ja","type":"sign","isPublic":false,"createdAt":1000,"updatedAt":2000}
          ],
          "artifactImages": [
            {"id":"image-1","artifactId":"artifact-1","imageUrl":"/api/images/user/image.jpg","sortOrder":0,"createdAt":2000}
          ],
          "artifactSentences": [
            {"id":"sentence-1","artifactId":"artifact-1","originalText":"出口","translation":"Exit","sortOrder":0,"createdAt":2000}
          ],
          "tombstones": []
        }
        """)

        try db.applyPull(initialPayload)
        XCTAssertEqual(try db.lastSyncAt(), 2000)
        XCTAssertEqual(try db.listNotes().first?.noteText, "server note")
        XCTAssertEqual(try db.listStudyCards().first?.word, "好")
        XCTAssertEqual(try db.listArtifacts().first?.sentenceCount, 1)
        XCTAssertEqual(try db.listArtifactSentences(artifactId: "artifact-1").first?.translation, "Exit")

        try db.upsertNote(character: "好", text: "newer dirty local note")
        let stalePayload = try decodePullPayload("""
        {
          "serverTime": 3000,
          "notes": [
            {"id":"note-1","character":"好","noteText":"stale server note","isAdmin":false,"createdAt":1000,"updatedAt":2500}
          ],
          "studyCards": [],
          "customWords": [],
          "artifacts": [],
          "artifactImages": [],
          "artifactSentences": [],
          "tombstones": []
        }
        """)

        try db.applyPull(stalePayload)
        XCTAssertEqual(try db.listNotes().first?.noteText, "newer dirty local note")
    }

    @MainActor
    func testSyncPushFailureRecordsRecoverableTaskError() async throws {
        let previousBaseURL = UserDefaults.standard.string(forKey: "cloudflareBaseURL")
        UserDefaults.standard.removeObject(forKey: "cloudflareBaseURL")
        defer {
            if let previousBaseURL {
                UserDefaults.standard.set(previousBaseURL, forKey: "cloudflareBaseURL")
            } else {
                UserDefaults.standard.removeObject(forKey: "cloudflareBaseURL")
            }
        }

        let db = try openEmptyDatabase()
        try db.upsertCustomWord(CustomWordDraft(
            word: "同期テスト",
            language: .ja,
            reading: "どうきてすと",
            definitions: "sync recovery test",
            notes: ""
        ))

        let engine = SyncEngine(database: db)
        do {
            try await engine.processQueue()
            XCTFail("Sync should fail without a Cloudflare base URL")
        } catch {
            XCTAssertTrue(error.localizedDescription.contains("Cloudflare base URL"))
        }

        let queued = try db.listSyncTasks()
        XCTAssertEqual(queued.count, 1)
        XCTAssertEqual(queued.first?.attempts, 1)
        XCTAssertTrue(queued.first?.lastError.contains("Cloudflare base URL") == true)
    }

    func testCloudflareSyncErrorsExplainCredentialRecovery() {
        XCTAssertEqual(
            CloudflareClientError.server(401).localizedDescription,
            "Cloudflare sync is unauthorized. Save a current Better Auth cookie in Settings."
        )
        XCTAssertEqual(
            CloudflareClientError.server(403).localizedDescription,
            "Cloudflare sync is forbidden for this account."
        )
        XCTAssertEqual(CloudflareClientError.server(500).localizedDescription, "Cloudflare returned HTTP 500.")
    }

    @MainActor
    func testSyncEnginePushesQueuedChangesAndPullsRemoteRowsThroughHTTPClient() async throws {
        let previousBaseURL = UserDefaults.standard.string(forKey: "cloudflareBaseURL")
        let previousCookie = try? SecureCredentialStore.string(account: SecureCredentialStore.cloudflareSessionCookieAccount)
        UserDefaults.standard.set("https://kiokun.test", forKey: "cloudflareBaseURL")
        try SecureCredentialStore.setString("better-auth.session_token=test-cookie", account: SecureCredentialStore.cloudflareSessionCookieAccount)
        defer {
            if let previousBaseURL {
                UserDefaults.standard.set(previousBaseURL, forKey: "cloudflareBaseURL")
            } else {
                UserDefaults.standard.removeObject(forKey: "cloudflareBaseURL")
            }
            if let previousCookie, !previousCookie.isEmpty {
                try? SecureCredentialStore.setString(previousCookie, account: SecureCredentialStore.cloudflareSessionCookieAccount)
            } else {
                try? SecureCredentialStore.delete(account: SecureCredentialStore.cloudflareSessionCookieAccount)
            }
            MockCloudflareURLProtocol.requestHandler = nil
        }

        let recorder = SyncHTTPRecorder()
        MockCloudflareURLProtocol.requestHandler = { request in
            try recorder.response(for: request)
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockCloudflareURLProtocol.self]
        let client = CloudflareClient(session: URLSession(configuration: configuration))

        let db = try openEmptyDatabase()
        try db.upsertNote(character: "語", text: "local mobile note")
        XCTAssertEqual(try db.listSyncTasks().count, 1)

        let engine = SyncEngine(database: db, client: client)
        try await engine.processQueue()

        let requests = recorder.snapshot()
        XCTAssertEqual(requests.map(\.path), ["/api/sync/push", "/api/sync/pull"])
        XCTAssertEqual(requests.first?.method, "POST")
        XCTAssertEqual(requests.first?.cookie, "better-auth.session_token=test-cookie")
        XCTAssertEqual(requests.last?.method, "GET")
        XCTAssertEqual(requests.last?.queryItems["since"], "0")

        let pushBody = try XCTUnwrap(requests.first?.jsonBody)
        XCTAssertEqual(pushBody["clientId"] as? String, "ios-native")
        let changes = try XCTUnwrap(pushBody["changes"] as? [[String: Any]])
        XCTAssertEqual(changes.count, 1)
        XCTAssertEqual(changes.first?["entity"] as? String, "note")
        XCTAssertEqual(changes.first?["entityId"] as? String, "語")
        XCTAssertEqual(changes.first?["operation"] as? String, "upsert")
        let payload = try XCTUnwrap(changes.first?["payload"] as? [String: Any])
        XCTAssertEqual(payload["character"] as? String, "語")
        XCTAssertEqual(payload["noteText"] as? String, "local mobile note")

        XCTAssertEqual(try db.listSyncTasks().count, 0)
        let notes = try db.listNotes()
        let localNote = try XCTUnwrap(notes.first { $0.character == "語" })
        XCTAssertFalse(localNote.dirty)
        let pulledNote = try XCTUnwrap(notes.first { $0.character == "遠" })
        XCTAssertEqual(pulledNote.noteText, "remote pulled note")
        XCTAssertFalse(pulledNote.dirty)
        XCTAssertEqual(try db.lastSyncAt(), 8000)
    }

    private func openFixtureDatabase() throws -> LocalDatabase {
        let bundle = Bundle(for: Self.self)
        let fixture = try XCTUnwrap(bundle.url(forResource: "KiokunDictionary", withExtension: "sqlite"))
        let directory = try makeTemporaryDirectory()
        let copy = directory.appendingPathComponent("KiokunDictionary.sqlite")
        try FileManager.default.copyItem(at: fixture, to: copy)
        let db = try LocalDatabase.openDatabase(at: copy)
        try db.createSchema()
        return db
    }

    private func openEmptyDatabase() throws -> LocalDatabase {
        let directory = try makeTemporaryDirectory()
        let db = try LocalDatabase.openDatabase(at: directory.appendingPathComponent("kiokun-test.sqlite"))
        try db.createSchema()
        return db
    }

    private func makeTemporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("KiokunTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        temporaryURLs.append(url)
        return url
    }

    private func decodePullPayload(_ json: String) throws -> CloudflarePullPayload {
        try JSONDecoder().decode(CloudflarePullPayload.self, from: Data(json.utf8))
    }

    private func makeTestJPEG() throws -> Data {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32))
        let image = renderer.image { context in
            UIColor.systemBlue.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 32, height: 32))
            UIColor.white.setFill()
            context.fill(CGRect(x: 8, y: 8, width: 16, height: 16))
        }
        return try XCTUnwrap(image.jpegData(compressionQuality: 0.9))
    }

    private func form(in table: JapaneseConjugationTable, _ label: String) -> String? {
        table.forms.first { $0.label == label }?.form
    }

    private func seedStaticAsset(_ db: LocalDatabase, path: String, json: String) throws {
        let source = Data(json.utf8)
        let compressed = try XCTUnwrap(RawDeflate.deflate(source))
        try db.run("""
        INSERT OR REPLACE INTO static_assets (path, compressedData, sourceBytes, compressedBytes, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        """, [
            .text(path),
            .blob(compressed),
            .int(Int64(source.count)),
            .int(Int64(compressed.count)),
            .int(1)
        ])
    }

    private func seedDictionaryEntry(_ db: LocalDatabase, key: String, json: String) throws {
        try db.run("""
        INSERT INTO dictionary_entries (key, json, sourceFormat, dictionaryVersion, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        """, [
            .text(key),
            .text(json),
            .text("json"),
            .text("test"),
            .int(1)
        ])
    }
}

private struct RecordedSyncRequest {
    var method: String
    var path: String
    var queryItems: [String: String]
    var cookie: String
    var jsonBody: [String: Any]?
}

private final class SyncHTTPRecorder {
    private let lock = NSLock()
    private var requests: [RecordedSyncRequest] = []

    func response(for request: URLRequest) throws -> (HTTPURLResponse, Data) {
        let url = try XCTUnwrap(request.url)
        let body = Self.bodyData(from: request)
        let json = body.isEmpty ? nil : try JSONSerialization.jsonObject(with: body) as? [String: Any]
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let recorded = RecordedSyncRequest(
            method: request.httpMethod ?? "",
            path: url.path,
            queryItems: Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).compactMap { item in
                item.value.map { (item.name, $0) }
            }),
            cookie: request.value(forHTTPHeaderField: "Cookie") ?? "",
            jsonBody: json
        )
        lock.withLock {
            requests.append(recorded)
        }

        switch url.path {
        case "/api/sync/push":
            let changes = json?["changes"] as? [[String: Any]] ?? []
            let applied = changes.compactMap { change -> [String: Any]? in
                guard let id = change["id"] as? String else { return nil }
                return ["id": id, "status": "applied"]
            }
            return try Self.jsonResponse(url: url, body: [
                "success": true,
                "serverTime": 7000,
                "applied": applied
            ])
        case "/api/sync/pull":
            return try Self.jsonResponse(url: url, body: [
                "serverTime": 8000,
                "notes": [
                    [
                        "id": "remote-note-1",
                        "character": "遠",
                        "noteText": "remote pulled note",
                        "isAdmin": false,
                        "createdAt": 6000,
                        "updatedAt": 8000
                    ]
                ],
                "studyCards": [],
                "customWords": [],
                "artifacts": [],
                "artifactImages": [],
                "artifactSentences": [],
                "tombstones": []
            ])
        default:
            return (
                HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: nil)!,
                Data()
            )
        }
    }

    func snapshot() -> [RecordedSyncRequest] {
        lock.withLock { requests }
    }

    private static func jsonResponse(url: URL, body: [String: Any]) throws -> (HTTPURLResponse, Data) {
        let data = try JSONSerialization.data(withJSONObject: body, options: [])
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        return (response, data)
    }

    private static func bodyData(from request: URLRequest) -> Data {
        if let body = request.httpBody {
            return body
        }
        guard let stream = request.httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 16 * 1024
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let count = stream.read(buffer, maxLength: bufferSize)
            if count > 0 {
                data.append(buffer, count: count)
            } else {
                break
            }
        }
        return data
    }
}

private final class MockCloudflareURLProtocol: URLProtocol {
    nonisolated(unsafe) static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            client?.urlProtocol(self, didFailWithError: CloudflareClientError.invalidResponse("Missing mock URLProtocol handler"))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
