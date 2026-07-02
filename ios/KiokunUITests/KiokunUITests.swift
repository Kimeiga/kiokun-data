import XCTest

final class KiokunUITests: XCTestCase {
    private let searchPrompt = "Search characters, words, or sentences..."

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    private func launchApp(environment: [String: String] = [:]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "--kiokun-reset-local-store",
            "-ApplePersistenceIgnoreState", "YES",
            "-UIStateRestorationDisable", "YES"
        ]
        app.launchEnvironment = environment
        app.launch()
        return app
    }

    @MainActor
    func testSearchFindsOfflineEntryAndOpensDetail() {
        let app = launchApp()
        let searchField = app.searchFields[searchPrompt]
        XCTAssertTrue(searchField.waitForExistence(timeout: 8))
        searchField.tap()
        searchField.typeText("hillock")

        let result = app.staticTexts["㐀"]
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        result.tap()

        XCTAssertTrue(app.navigationBars["㐀"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testDictionaryDetailRendersRichOfflineRecordMetadata() {
        let app = launchApp(environment: ["KIOKUN_UI_TEST_RICH_RENDERER_RECORD": "1"])
        let searchField = app.searchFields[searchPrompt]
        XCTAssertTrue(searchField.waitForExistence(timeout: 8))
        searchField.tap()
        searchField.typeText("rendererparity")

        let result = app.buttons.matching(identifier: "search.result.語").firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        result.tap()

        XCTAssertTrue(app.navigationBars["語"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["chineseEntry.語 / 语"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["movie rank 42"].exists)
        XCTAssertFalse(app.staticTexts["Jyutping jyu5"].exists)

        XCTAssertTrue(scrollToAnyElement(identifier: "japaneseEntry.語", app: app).exists)
        XCTAssertTrue(app.staticTexts["irregular kanji"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["noun"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["(figurative) language"].waitForExistence(timeout: 5))

        let examples = app.buttons.matching(
            NSPredicate(format: "identifier == %@ AND label == %@", "japaneseEntry.語", "Examples (1)")
        ).firstMatch
        if examples.waitForExistence(timeout: 2) {
            examples.tap()
            XCTAssertTrue(app.staticTexts["日本語を話します。"].waitForExistence(timeout: 5))
        }

        XCTAssertTrue(scrollToAnyElement(identifier: "koreanEntry.어 / 語", app: app).exists)
        XCTAssertTrue(app.staticTexts["sino_korean"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["rank 77"].waitForExistence(timeout: 5))

        XCTAssertTrue(scrollToStaticText("Character Forms", app: app).exists)
        XCTAssertTrue(app.descendants(matching: .any)["characterForms.語"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Traditional / Japanese / Korean"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["characterForms.语"].waitForExistence(timeout: 5))

        XCTAssertTrue(scrollToAnyElement(identifier: "characterSummary.zh.語", app: app).exists)
        XCTAssertTrue(app.staticTexts["Chinese character"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Components"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Equation"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["componentStrokePreview.吾"].waitForExistence(timeout: 5))
        XCTAssertTrue(scrollToStaticText("Phonetic component", app: app).exists)
        XCTAssertTrue(app.staticTexts["wú"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["phonetic cue"].waitForExistence(timeout: 5))
        XCTAssertTrue(scrollToStaticText("Component Uses", app: app).exists)
        XCTAssertTrue(app.staticTexts["Meaning component"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["in 2 characters (1 verified)"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["譯"].waitForExistence(timeout: 5))
        XCTAssertTrue(scrollToStaticText("Codepoint", app: app).exists)
        XCTAssertTrue(app.staticTexts["U+8A9E"].waitForExistence(timeout: 5))
        XCTAssertTrue(scrollToStaticText("Top Words", app: app).exists)
        XCTAssertTrue(app.staticTexts["語言"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Historical Pronunciations (1)"].waitForExistence(timeout: 5))
        XCTAssertTrue(scrollToStaticText("Historical Evolution", app: app).exists)
        XCTAssertTrue(app.descendants(matching: .any)["historicalStrokePreview.seal"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["seal"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Qin"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Regular"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Modern"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Comments"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["test"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["common phonetic series"].waitForExistence(timeout: 5))

        XCTAssertTrue(scrollToStaticText("Similar Characters", app: app).exists)
        XCTAssertTrue(app.staticTexts["信"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["trust"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testSentenceLikeSearchShowsBreakdownAndOpensReader() {
        let app = launchApp(environment: ["KIOKUN_UI_TEST_RICH_RENDERER_RECORD": "1"])
        let searchField = app.searchFields[searchPrompt]
        XCTAssertTrue(searchField.waitForExistence(timeout: 8))
        searchField.tap()
        searchField.typeText("語を話します。")

        let openReader = app.descendants(matching: .any)["sentenceBreakdown.open"]
        XCTAssertTrue(openReader.waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["sentenceBreakdown.tokens"].waitForExistence(timeout: 5))
        openReader.tap()

        XCTAssertTrue(app.navigationBars["Sentence Reader"].waitForExistence(timeout: 5))
        let readerInput = app.textFields["sentenceReader.input"]
        XCTAssertTrue(readerInput.waitForExistence(timeout: 5))
        XCTAssertTrue((readerInput.value as? String)?.contains("語を話します。") == true)
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", "sentenceReader.token.")).firstMatch.waitForExistence(timeout: 5))
    }

    @MainActor
    func testDictionaryExampleSentenceNavigatesToReader() {
        let app = launchApp(environment: ["KIOKUN_UI_TEST_RICH_RENDERER_RECORD": "1"])
        let searchField = app.searchFields[searchPrompt]
        XCTAssertTrue(searchField.waitForExistence(timeout: 8))
        searchField.tap()
        searchField.typeText("rendererparity")

        let result = app.buttons.matching(identifier: "search.result.語").firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        result.tap()

        XCTAssertTrue(app.navigationBars["語"].waitForExistence(timeout: 5))
        XCTAssertTrue(scrollToAnyElement(identifier: "japaneseEntry.語", app: app).exists)

        let examples = app.buttons.matching(
            NSPredicate(format: "identifier == %@ AND label == %@", "japaneseEntry.語", "Examples (1)")
        ).firstMatch
        if examples.waitForExistence(timeout: 2) {
            examples.tap()
        }

        let exampleRow = app.descendants(matching: .any)["sentenceExample.open.ja.日本語を話します。"]
        XCTAssertTrue(exampleRow.waitForExistence(timeout: 5))
        exampleRow.tap()

        XCTAssertTrue(app.navigationBars["Sentence Reader"].waitForExistence(timeout: 5))
        let readerInput = app.textFields["sentenceReader.input"]
        XCTAssertTrue(readerInput.waitForExistence(timeout: 5))
        XCTAssertTrue((readerInput.value as? String)?.contains("日本語を話します。") == true)
    }

    @MainActor
    func testSearchShowsNativeHandwritingInput() {
        let app = launchApp(environment: ["KIOKUN_HANDWRITING_MOCK_CANDIDATES": "語,学"])
        let handwriting = app.buttons["handwriting.open"]
        XCTAssertTrue(handwriting.waitForExistence(timeout: 8))
        handwriting.tap()

        XCTAssertTrue(app.navigationBars["Handwriting"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Undo"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Clear"].waitForExistence(timeout: 5))

        let candidate = app.buttons["語"]
        XCTAssertTrue(candidate.waitForExistence(timeout: 5))
        candidate.tap()

        let searchField = app.searchFields[searchPrompt]
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        XCTAssertTrue((searchField.value as? String)?.contains("語") == true)
    }

    @MainActor
    func testCreatesCustomWordOfflineAndShowsInLists() {
        let app = launchApp()
        let add = app.buttons["customWord.add"]
        XCTAssertTrue(add.waitForExistence(timeout: 8))
        add.tap()

        let word = app.textFields["customWord.word"]
        XCTAssertTrue(word.waitForExistence(timeout: 5))
        word.tap()
        word.typeText("地下テスト")

        let reading = app.textFields["customWord.reading"]
        reading.tap()
        reading.typeText("ちかてすと")

        let definitions = app.textViews["customWord.definitions"]
        XCTAssertTrue(definitions.exists)
        definitions.tap()
        definitions.typeText("subway native test word")

        app.buttons["customWord.save"].tap()
        openTab("Lists", app: app)

        XCTAssertTrue(app.staticTexts["地下テスト"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["ちかてすと"].exists)
    }

    @MainActor
    func testCreatesArtifactAndAddsSentenceOffline() {
        let app = launchApp()
        openArtifactsList(app: app)

        let add = app.buttons["artifact.add"]
        XCTAssertTrue(add.waitForExistence(timeout: 5))
        add.tap()

        let title = app.textFields["artifact.title"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("Subway Sign")

        let description = app.textFields["artifact.description"]
        description.tap()
        description.typeText("Captured offline in a UI test")

        app.buttons["artifact.save"].tap()

        let row = app.staticTexts["Subway Sign"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.tap()

        let original = app.textFields["artifactSentence.original"]
        XCTAssertTrue(original.waitForExistence(timeout: 5))
        original.tap()
        original.typeText("出口")

        let translation = app.textFields["artifactSentence.translation"]
        translation.tap()
        translation.typeText("Exit")

        app.buttons["artifactSentence.save"].tap()
        XCTAssertTrue(app.staticTexts["出口"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Exit"].exists)
    }

    @MainActor
    func testArtifactPhotoPickerAddsOfflineImage() {
        let app = launchApp(environment: ["KIOKUN_UI_TEST_IMAGE_ATTACH": "1"])
        openArtifactsList(app: app)

        let add = app.buttons["artifact.add"]
        XCTAssertTrue(add.waitForExistence(timeout: 5))
        add.tap()

        let title = app.textFields["artifact.title"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("Photo Fixture")

        let description = app.textFields["artifact.description"]
        description.tap()
        description.typeText("Image picked from simulator Photos")

        app.buttons["artifact.save"].tap()

        let row = app.staticTexts["Photo Fixture"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.tap()

        let attach = app.buttons["artifactImage.attach"]
        XCTAssertTrue(attach.waitForExistence(timeout: 5))
        let inject = app.buttons["artifactImage.injectUITest"]
        if inject.waitForExistence(timeout: 2) {
            inject.tap()
        } else {
            attach.tap()
            chooseFirstPhotoFromPicker(app: app)
        }

        let gallery = scrollToAnyElement(identifier: "artifactImage.gallery", app: app)
        XCTAssertTrue(gallery.waitForExistence(timeout: 10))
        let preview = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@ AND identifier != %@ AND identifier != %@", "artifactImage.", "artifactImage.attach", "artifactImage.gallery")
        ).firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 10))
    }

    @MainActor
    func testStudyReviewExposesNativeSpeechControls() {
        let app = launchApp(environment: [
            "KIOKUN_UI_TEST_STUDY_CARD": "食べる",
            "KIOKUN_UI_TEST_STUDY_LANGUAGE": "ja",
            "KIOKUN_UI_TEST_STUDY_READING": "たべる",
            "KIOKUN_UI_TEST_STUDY_DEFINITION": "to eat"
        ])
        openTab("Study", app: app)

        XCTAssertTrue(app.navigationBars["Study"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["食べる"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["speech.ja.食べる"].waitForExistence(timeout: 5))

        let showAnswer = app.buttons["Show answer"]
        XCTAssertTrue(showAnswer.waitForExistence(timeout: 5))
        showAnswer.tap()

        XCTAssertTrue(app.buttons["Listen again"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["speech.ja.食べる"].exists)
    }

    @MainActor
    func testOfflineGameLoadsFromBundledData() {
        let app = launchApp()
        openTab("Game", app: app)

        XCTAssertTrue(app.navigationBars["Sentence Game"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["game.english"].waitForExistence(timeout: 8))
        let chinese = app.buttons["中文"]
        XCTAssertTrue(chinese.waitForExistence(timeout: 5))
        chinese.tap()
        let traditional = app.buttons["繁體"]
        XCTAssertTrue(traditional.waitForExistence(timeout: 5))
        traditional.tap()
        let bankTile = scrollToFirstButton(prefix: "game.bankTile.", app: app, direction: .up)
        XCTAssertTrue(bankTile.waitForExistence(timeout: 5))
        bankTile.tap()
        let answerTile = scrollToFirstButton(prefix: "game.answerTile.", app: app, direction: .down)
        XCTAssertTrue(answerTile.waitForExistence(timeout: 5))
        app.swipeUp()
        XCTAssertTrue(app.buttons["game.listen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["game.reset"].exists)
        XCTAssertTrue(app.buttons["game.reveal"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["game.new"].exists)
        app.swipeUp()
        XCTAssertTrue(app.buttons["game.copyAsk"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testSentenceReaderLooksUpTappedTokenOffline() {
        let app = launchApp(environment: ["KIOKUN_UI_TEST_RICH_RENDERER_RECORD": "1"])
        openTab("Library", app: app)
        XCTAssertTrue(app.navigationBars["Library"].waitForExistence(timeout: 5))

        let reader = scrollToAnyElement(identifier: "library.sentenceReader", app: app)
        XCTAssertTrue(reader.exists)
        reader.tap()

        XCTAssertTrue(app.navigationBars["Sentence Reader"].waitForExistence(timeout: 5))
        let chinese = app.buttons["Chinese"]
        XCTAssertTrue(chinese.waitForExistence(timeout: 5))
        chinese.tap()

        let input = app.textFields["sentenceReader.input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.tap()
        input.typeText("語")
        let keyboardDone = app.buttons["sentenceReader.keyboardDone"]
        if keyboardDone.waitForExistence(timeout: 2) {
            keyboardDone.tap()
        }

        let token = app.buttons["sentenceReader.token.語"]
        XCTAssertTrue(token.waitForExistence(timeout: 5))
        token.tap()

        XCTAssertTrue(app.descendants(matching: .any)["sentenceReader.lookupPanel"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["language"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["sentenceReader.openEntry"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testLibraryHomophonesAndFrequencyBrowseOffline() {
        let app = launchApp()
        openTab("Library", app: app)

        let homophones = app.staticTexts["Homophones"]
        XCTAssertTrue(homophones.waitForExistence(timeout: 5))
        homophones.tap()

        XCTAssertTrue(app.navigationBars["Homophones"].waitForExistence(timeout: 5))
        let homophoneSearch = app.textFields["homophones.search"]
        XCTAssertTrue(homophoneSearch.waitForExistence(timeout: 5))
        homophoneSearch.tap()
        homophoneSearch.typeText("kakehiki")
        XCTAssertTrue(app.staticTexts["かけひき"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["駆け引き"].waitForExistence(timeout: 5))

        app.terminate()
        let frequencyApp = launchApp()
        openTab("Library", app: frequencyApp)

        let frequency = scrollToStaticText("Frequency", app: frequencyApp)
        XCTAssertTrue(frequency.exists)
        frequency.tap()

        XCTAssertTrue(frequencyApp.navigationBars["Frequency"].waitForExistence(timeout: 5))
        XCTAssertTrue(frequencyApp.staticTexts["に"].waitForExistence(timeout: 5))
        let chinese = frequencyApp.buttons["中文"]
        XCTAssertTrue(chinese.waitForExistence(timeout: 5))
        chinese.tap()
        XCTAssertTrue(frequencyApp.staticTexts["的"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testLibraryReelsOpenOfflineTranscript() {
        let app = launchApp()
        openTab("Library", app: app)

        let reels = scrollToStaticText("Reels", app: app)
        XCTAssertTrue(reels.exists)
        reels.tap()

        XCTAssertTrue(app.navigationBars["Reels"].waitForExistence(timeout: 10))
        let search = app.textFields["reels.search"]
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap()
        search.typeText("e77a9f2f")

        let reel = app.descendants(matching: .any)["reels.videoLink.e77a9f2f-7582-4ab3-b516-4a74c9d1a395"]
        XCTAssertTrue(reel.waitForExistence(timeout: 5))
        reel.tap()

        XCTAssertTrue(app.descendants(matching: .any)["reels.fullScreen"].waitForExistence(timeout: 5))
        let customBack = app.buttons["reels.back"]
        if !customBack.waitForExistence(timeout: 2) {
            XCTAssertTrue(app.buttons["Back"].waitForExistence(timeout: 5))
        }
        XCTAssertTrue(app.descendants(matching: .any)["reels.transcriptOverlay"].waitForExistence(timeout: 5))
        let transcriptWord = element(identifier: "reels.word.宮下", app: app)
        XCTAssertTrue(transcriptWord.waitForExistence(timeout: 5))
        transcriptWord.tap()

        XCTAssertTrue(app.descendants(matching: .any)["reels.lookupPanel"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Miyashita"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["reels.lookupOpenEntry"].waitForExistence(timeout: 5))
        app.buttons["reels.lookupOpenEntry"].tap()

        XCTAssertTrue(app.navigationBars["宮下"].waitForExistence(timeout: 5))
        XCTAssertTrue(scrollToStaticText("Japanese Reels (1)", app: app).exists)
        let occurrence = scrollToAnyElement(identifier: "reelOccurrence.ja.e77a9f2f-7582-4ab3-b516-4a74c9d1a395", app: app)
        XCTAssertTrue(occurrence.exists)
    }

    @MainActor
    func testLibraryPhoneticsBrowseOfflineSeries() {
        let app = launchApp()
        openTab("Library", app: app)

        let phonetics = scrollToStaticText("Phonetics", app: app)
        XCTAssertTrue(phonetics.exists)
        phonetics.tap()

        XCTAssertTrue(app.navigationBars["Phonetics"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["phonetic.component"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["青"].waitForExistence(timeout: 5))
        let gloss = app.staticTexts["phonetic.componentGloss"]
        XCTAssertTrue(gloss.waitForExistence(timeout: 5))
        expectation(
            for: NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS[c] %@", "blue", "green"),
            evaluatedWith: gloss
        )
        waitForExpectations(timeout: 5)
        let seriesCount = app.staticTexts["phonetic.seriesCount"]
        XCTAssertTrue(seriesCount.waitForExistence(timeout: 5))
        expectation(
            for: NSPredicate(format: "NOT label CONTAINS %@", "0 characters"),
            evaluatedWith: seriesCount
        )
        waitForExpectations(timeout: 5)
    }

    @MainActor
    func testSettingsShowsCloudflareCredentialControls() {
        let app = launchApp()
        openTab("Settings", app: app)

        let cookie = app.descendants(matching: .any)["settings.cloudflareCookie"]
        XCTAssertTrue(cookie.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["settings.signInGoogle"].waitForExistence(timeout: 5))

        let saveButton = app.buttons["settings.saveCloudflareCookie"]
        if !saveButton.waitForExistence(timeout: 1) {
            app.swipeUp()
        }
        XCTAssertTrue(saveButton.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["settings.pasteCloudflareCookie"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["settings.clearCloudflareCookie"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testSettingsNativeAuthMockSavesAndClearsKeychainCredential() {
        let app = launchApp(environment: ["KIOKUN_UI_TEST_AUTH_COOKIE": "better-auth.session_token=ui-test"])
        openTab("Settings", app: app)

        let baseURL = scrollToAnyElement(identifier: "settings.cloudflareBaseURL", app: app)
        XCTAssertTrue(baseURL.waitForExistence(timeout: 5))
        baseURL.tap()
        baseURL.typeText("https://kiokun.example")

        let signIn = app.buttons["settings.signInGoogle"]
        XCTAssertTrue(signIn.waitForExistence(timeout: 5))
        XCTAssertTrue(signIn.isEnabled)
        signIn.tap()

        let status = app.staticTexts["settings.credentialStatus"]
        expectation(
            for: NSPredicate(format: "label CONTAINS %@", "Signed in. Credential saved to Keychain."),
            evaluatedWith: status
        )
        waitForExpectations(timeout: 5)

        let clear = app.buttons["settings.clearCloudflareCookie"]
        XCTAssertTrue(clear.waitForExistence(timeout: 5))
        XCTAssertTrue(clear.isEnabled)
        clear.tap()

        expectation(
            for: NSPredicate(format: "label CONTAINS %@", "Credential cleared."),
            evaluatedWith: status
        )
        waitForExpectations(timeout: 5)
    }

    @MainActor
    func testSettingsSyncRecoveryExplainsMissingCloudflareBaseURL() {
        let app = launchApp(environment: ["KIOKUN_UI_TEST_SYNC_TASK": "1"])
        openTab("Settings", app: app)

        let syncButton = scrollToAnyElement(identifier: "settings.syncNow", app: app)
        XCTAssertTrue(syncButton.waitForExistence(timeout: 5))
        syncButton.tap()

        let status = app.staticTexts["settings.syncStatus"]
        let statusPredicate = NSPredicate(format: "label CONTAINS %@", "Set a Cloudflare base URL in Settings before syncing.")
        expectation(for: statusPredicate, evaluatedWith: status)
        waitForExpectations(timeout: 5)

        XCTAssertTrue(scrollToStaticText("customWord.upsert", app: app).exists)
        XCTAssertTrue(app.staticTexts["同期テスト"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Attempts: 1"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Set a Cloudflare base URL in Settings before syncing."].waitForExistence(timeout: 5))
    }

    @MainActor
    private func scrollToStaticText(_ label: String, app: XCUIApplication) -> XCUIElement {
        let element = app.staticTexts[label]
        if element.waitForExistence(timeout: 1) {
            return element
        }
        for _ in 0..<5 {
            app.swipeUp()
            if element.waitForExistence(timeout: 1) {
                break
            }
        }
        return element
    }

    @MainActor
    private func scrollToAnyElement(identifier: String, app: XCUIApplication) -> XCUIElement {
        let element = app.descendants(matching: .any)[identifier]
        if element.waitForExistence(timeout: 1) {
            return element
        }
        for _ in 0..<8 {
            app.swipeUp()
            if element.waitForExistence(timeout: 1) {
                break
            }
        }
        return element
    }

    private enum ScrollDirection {
        case up
        case down
    }

    @MainActor
    private func scrollToFirstButton(prefix: String, app: XCUIApplication, direction: ScrollDirection) -> XCUIElement {
        let element = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix)).firstMatch
        if element.waitForExistence(timeout: 1) {
            return element
        }
        for _ in 0..<8 {
            switch direction {
            case .up:
                app.swipeUp()
            case .down:
                app.swipeDown()
            }
            if element.waitForExistence(timeout: 1) {
                break
            }
        }
        return element
    }

    @MainActor
    private func element(identifier: String, app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@", identifier)).firstMatch
    }

    @MainActor
    private func chooseFirstPhotoFromPicker(app: XCUIApplication) {
        if app.buttons["Continue"].waitForExistence(timeout: 1) {
            app.buttons["Continue"].tap()
        }
        if app.buttons["Close"].waitForExistence(timeout: 1) {
            app.buttons["Close"].tap()
        }

        let photoTile = app.images.matching(
            NSPredicate(format: "identifier == %@ AND label BEGINSWITH %@", "PXGGridLayout-Info", "Photo")
        ).firstMatch
        if photoTile.waitForExistence(timeout: 5) {
            photoTile.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        } else {
            let firstCell = app.collectionViews.cells.element(boundBy: 0)
            XCTAssertTrue(firstCell.waitForExistence(timeout: 5))
            firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }

        if app.buttons["Add"].waitForExistence(timeout: 2) {
            app.buttons["Add"].tap()
        } else if app.buttons["Done"].waitForExistence(timeout: 2) {
            app.buttons["Done"].tap()
        }
        _ = app.buttons["artifactImage.attach"].waitForExistence(timeout: 5)
    }

    @MainActor
    private func openTab(_ name: String, app: XCUIApplication) {
        if app.tabBars.buttons[name].waitForExistence(timeout: 2) {
            app.tabBars.buttons[name].tap()
            return
        }

        let more = app.tabBars.buttons["More"]
        XCTAssertTrue(more.waitForExistence(timeout: 5))
        more.tap()

        if let moreIdentifier = moreIdentifier(for: name) {
            let explicitItem = app.descendants(matching: .any)[moreIdentifier]
            if explicitItem.waitForExistence(timeout: 3) {
                explicitItem.tap()
                return
            }
        }

        let moreItem = app.tables.staticTexts[name]
        XCTAssertTrue(moreItem.waitForExistence(timeout: 5))
        moreItem.tap()
    }

    private func moreIdentifier(for name: String) -> String? {
        switch name {
        case "Library":
            return "more.library"
        case "Artifacts":
            return "more.artifacts"
        case "Settings":
            return "more.settings"
        default:
            return nil
        }
    }

    @MainActor
    private func openArtifactsList(app: XCUIApplication) {
        openTab("Artifacts", app: app)
        if app.buttons["artifact.add"].waitForExistence(timeout: 2) {
            return
        }

        for _ in 0..<3 {
            let artifactsBack = app.navigationBars.buttons["Artifacts"]
            let genericBack = app.navigationBars.buttons["Back"]
            if artifactsBack.exists {
                artifactsBack.tap()
            } else if genericBack.exists {
                genericBack.tap()
            } else {
                break
            }

            if app.buttons["artifact.add"].waitForExistence(timeout: 2) {
                return
            }
        }
    }
}
