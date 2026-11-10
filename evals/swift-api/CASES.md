# Swift API eval cases

This file collects the task and reference answer of each case for review.
Each case directory under `cases/` also holds the check file,
a stale answer, a stub answer, and metadata.
`scripts/verify-cases` type-checks every case against the SDK;
`scripts/render-cases.ts` regenerates this file.

## New in round 2

These 8 cases have `"round": 2` in `meta.json`.

- [ios-appintents-execution-targets](#ios-appintents-execution-targets) (AppIntents)
- [ios-nowplaying-media-commands](#ios-nowplaying-media-commands) (NowPlaying)
- [ios-photosui-picker-search](#ios-photosui-picker-search) (PhotosUI)
- [ios-uikit-bar-minimization](#ios-uikit-bar-minimization) (UIKit)
- [ios-uikit-grammar-checking](#ios-uikit-grammar-checking) (UIKit)
- [ios-uikit-reduced-resource-usage](#ios-uikit-reduced-resource-usage) (UIKit)
- [ios-uikit-scene-closure-confirmation](#ios-uikit-scene-closure-confirmation) (UIKit)
- [ios-uikit-sheet-placement](#ios-uikit-sheet-placement) (UIKit)

| ID | Framework | Source | Target | Required symbols |
| --- | --- | --- | --- | --- |
| [appkit-window-key-message](#appkit-window-key-message) | AppKit | sdk-diff | `arm64-apple-macos27.0` | `addObserver(of`, `didBecomeKey` |
| [avfoundation-resumable-export](#avfoundation-resumable-export) | AVFoundation | sdk-diff | `arm64-apple-macos27.0` | `configureForResumableExport` |
| [control-directory-listing](#control-directory-listing) | Foundation | control | `arm64-apple-macos27.0` | `contentsOfDirectory`, `skipsHiddenFiles` |
| [control-iso8601-fractional-seconds](#control-iso8601-fractional-seconds) | Foundation | control | `arm64-apple-macos27.0` | `ISO8601` |
| [control-logger-privacy](#control-logger-privacy) | os | control | `arm64-apple-macos27.0` | `privacy` |
| [control-sha256-hex](#control-sha256-hex) | CryptoKit | control | `arm64-apple-macos27.0` | `SHA256` |
| [control-urlsession-status](#control-urlsession-status) | Foundation | control | `arm64-apple-macos27.0` | `URLSession`, `HTTPURLResponse` |
| [coredata-remote-change-message](#coredata-remote-change-message) | CoreData | sdk-diff | `arm64-apple-macos27.0` | `messages(of`, `remoteChange` |
| [cryptokit-one-time-kem](#cryptokit-one-time-kem) | CryptoKit | sdk-diff | `arm64-apple-macos26.0` | `OneTimePrivateKey`, `decapsulate` |
| [fm-context-size-exceeded](#fm-context-size-exceeded) | FoundationModels | sdk-diff | `arm64-apple-macos27.0` | `contextSizeExceeded`, `LanguageModelError` |
| [fm-custom-language-model](#fm-custom-language-model) | FoundationModels | failure | `arm64-apple-macos27.0` | `LanguageModelExecutor`, `LanguageModelCapabilities`, `.send(` |
| [fm-image-attachment](#fm-image-attachment) | FoundationModels | failure | `arm64-apple-macos27.0` | `capabilities`, `vision`, `AttachmentSegment`, `ImageAttachment` |
| [fm-session-property-sendable](#fm-session-property-sendable) | FoundationModels | failure | `arm64-apple-macos27.0` | `SessionProperty` |
| [fm-token-budget](#fm-token-budget) | FoundationModels | failure | `arm64-apple-macos26.0` | `contextSize`, `tokenCount` |
| [foundation-predicate-all](#foundation-predicate-all) | Foundation | sdk-diff | `arm64-apple-macos27.0` | `Predicate` |
| [foundation-progress-manager](#foundation-progress-manager) | Foundation | sdk-diff | `arm64-apple-macos27.0` | `start(totalCount`, `complete(count` |
| [healthkit-earliest-authorized-date](#healthkit-earliest-authorized-date) | HealthKit | sdk-diff | `arm64-apple-macos26.0` | `earliestAuthorizedSampleDate`, `earliestPermittedSampleDate` |
| [imageplayground-creation-strategy](#imageplayground-creation-strategy) | ImagePlayground | sdk-diff | `arm64-apple-macos26.4` | `creationStrategy`, `editExisting` |
| [ios-appintents-execution-targets](#ios-appintents-execution-targets) | AppIntents | sdk-diff | `arm64-apple-ios27.0` | `allowedExecutionTargets`, `refresh` |
| [ios-nowplaying-media-commands](#ios-nowplaying-media-commands) | NowPlaying | sdk-diff | `arm64-apple-ios27.0` | `skipForward`, `skipBackward`, `preferredIntervals` |
| [ios-photosui-picker-search](#ios-photosui-picker-search) | PhotosUI | sdk-diff | `arm64-apple-ios27.0` | `searchText`, `PHPickerSearchText` |
| [ios-uikit-bar-minimization](#ios-uikit-bar-minimization) | UIKit | sdk-diff | `arm64-apple-ios27.0` | `navigationBarMinimization`, `onScrollDown`, `atScrollEdge` |
| [ios-uikit-grammar-checking](#ios-uikit-grammar-checking) | UIKit | sdk-diff | `arm64-apple-ios27.0` | `grammarCheckingType`, `spellCheckingType`, `autocorrectionType`, `smartQuotesType` |
| [ios-uikit-reduced-resource-usage](#ios-uikit-reduced-resource-usage) | UIKit | sdk-diff | `arm64-apple-ios26.0` | `systemPrefersReducedResourceUsage`, `isLowPowerModeEnabled` |
| [ios-uikit-scene-closure-confirmation](#ios-uikit-scene-closure-confirmation) | UIKit | sdk-diff | `arm64-apple-ios27.0` | `closureConfirmation`, `UISceneClosureConfirmation` |
| [ios-uikit-sheet-placement](#ios-uikit-sheet-placement) | UIKit | sdk-diff | `arm64-apple-ios26.0` | `preferredPlacement`, `trailing` |
| [metrickit-diagnostic-reports](#metrickit-diagnostic-reports) | MetricKit | sdk-diff | `arm64-apple-macos27.0` | `diagnosticReports`, `crash` |
| [network-dtls](#network-dtls) | Network | sdk-diff | `arm64-apple-macos27.0` | `NetworkConnection`, `DTLS`, `UDP`, `DTLSv12` |
| [observation-continuous](#observation-continuous) | Observation | sdk-diff | `arm64-apple-macos27.0` | `withContinuousObservation` |
| [speech-input-converter](#speech-input-converter) | Speech | sdk-diff | `arm64-apple-macos26.0` | `AnalyzerInputConverter`, `bestAvailableAudioFormat` |
| [storekit-store-type](#storekit-store-type) | StoreKit | sdk-diff | `arm64-apple-macos27.0` | `AppTransaction`, `storeType`, `education` |
| [swift-array-sendable](#swift-array-sendable) | Swift | failure | `arm64-apple-macos27.0` | `Sendable` |
| [swift-cancellation-shield](#swift-cancellation-shield) | Swift | sdk-diff | `arm64-apple-macos27.0` | `withTaskCancellationShield`, `hasActiveCancellationShield` |
| [swift-span-byte-order](#swift-span-byte-order) | Swift | sdk-diff | `arm64-apple-macos26.0` | `bigEndian`, `load` |
| [swift-unique-array](#swift-unique-array) | Swift | sdk-diff | `arm64-apple-macos27.0` | `UniqueArray`, `append` |
| [swiftdata-sectioned-results](#swiftdata-sectioned-results) | SwiftData | sdk-diff | `arm64-apple-macos27.0` | `sectionBy`, `sectionTitles` |
| [swiftui-tabs-picker](#swiftui-tabs-picker) | SwiftUI | sdk-diff | `arm64-apple-macos26.0` | `.tabs`, `pickerStyle` |
| [system-pipe-options](#system-pipe-options) | System | sdk-diff | `arm64-apple-macos27.0` | `pipe(options`, `closeOnExec` |
| [uttype-markdown](#uttype-markdown) | UniformTypeIdentifiers | sdk-diff | `arm64-apple-macos26.0` | `markdown` |
| [virtualization-secure-boot](#virtualization-secure-boot) | Virtualization | sdk-diff | `arm64-apple-macos27.0` | `isSecureBootEnabled` |
| [widgetkit-extra-large-portrait](#widgetkit-extra-large-portrait) | WidgetKit | sdk-diff | `arm64-apple-macos26.0` | `systemExtraLargePortrait` |

## appkit-window-key-message

- Framework: AppKit
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/appkit/nswindow/didbecomekeymessage>, <https://sosumi.ai/documentation/foundation/notificationcenter/addobserver(of:for:using:)-4d19x>

The macOS 27 SDK adds typed AppKit messages such as NSWindow.DidBecomeKeyMessage (a NotificationCenter.MainActorMessage) with the identifier .didBecomeKey; MacOSX26.5.sdk has none of these NSWindow messages. NotificationCenter.addObserver(of:for:using:) returns an ObservationToken; the name-based addObserver(forName:object:queue:using:) returns NSObjectProtocol.

### task.md

````markdown
# React when a window becomes key, with typed notifications

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: AppKit

A document window refreshes its inspector whenever it becomes the key window.
The app uses Foundation's typed, concurrency-safe notification messages
instead of name-based notifications with untyped user-info dictionaries.
The observation lasts until the caller releases the returned token.

Declare:

```swift
@MainActor
func observeBecomingKey(
    _ window: NSWindow,
    perform action: @escaping @MainActor () -> Void
) -> NotificationCenter.ObservationToken
```

Call `action` on the main actor each time `window` becomes key.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import AppKit

@MainActor
func observeBecomingKey(
    _ window: NSWindow,
    perform action: @escaping @MainActor () -> Void
) -> NotificationCenter.ObservationToken {
    NotificationCenter.default.addObserver(of: window, for: .didBecomeKey) { _ in
        action()
    }
}
```

## avfoundation-resumable-export

- Framework: AVFoundation
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/avfoundation/avassetexportsession/configureforresumableexport()>, <https://sosumi.ai/documentation/avfoundation/avassetexportsession/resumptionstate>

The macOS 27 SDK adds AVAssetExportSession.configureForResumableExport() async -> ResumptionState, an enum with resumable(isResumingFromPreviousState:) and notResumable(failureReason:).

### task.md

````markdown
# Prepare a long video export so it can resume

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: AVFoundation

A video editor exports long projects.
Before it starts an export, it asks the export session to prepare
so that an interrupted export can resume later.
The editor records whether the export can resume and,
when it cannot, shows a short reason in its activity log.

Declare:

```swift
func prepareResumableExport(_ session: AVAssetExportSession) async -> String?
```

Return `nil` when the export can resume.
Otherwise return a description of the reason
(any string made from the reason that the session reports).

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import AVFoundation

func prepareResumableExport(_ session: AVAssetExportSession) async -> String? {
    switch await session.configureForResumableExport() {
    case .resumable:
        return nil
    case .notResumable(let failureReason):
        return String(describing: failureReason)
    @unknown default:
        return "Unknown resumption state"
    }
}
```

## control-directory-listing

- Framework: Foundation
- Source: control
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundation/filemanager/contentsofdirectory(at:includingpropertiesforkeys:options:)>, <https://sosumi.ai/documentation/foundation/filemanager/directoryenumerationoptions/skipshiddenfiles>

Control case. FileManager.contentsOfDirectory(at:includingPropertiesForKeys:options:) has been available since macOS 10.6; its includingPropertiesForKeys parameter has no default value.

### task.md

````markdown
# List the Swift files in a folder

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation

A code formatter lists the Swift source files directly inside a folder.
It does not look into subfolders, and it skips hidden files.

Declare:

```swift
func swiftFiles(in directory: URL) throws -> [URL]
```

Return the URLs of the folder's visible entries whose path extension is `swift`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation

func swiftFiles(in directory: URL) throws -> [URL] {
    try FileManager.default
        .contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: .skipsHiddenFiles
        )
        .filter { $0.pathExtension == "swift" }
}
```

## control-iso8601-fractional-seconds

- Framework: Foundation
- Source: control
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundation/iso8601dateformatter>, <https://sosumi.ai/documentation/foundation/iso8601dateformatter/options/withfractionalseconds>

Control case. ISO8601DateFormatter.Options.withFractionalSeconds has been available since macOS 10.13. Date.ISO8601FormatStyle(includingFractionalSeconds: true) is an equally valid answer, so the required symbol is only ISO8601.

### task.md

````markdown
# Parse server timestamps with fractional seconds

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation

A server sends timestamps such as `2026-03-14T15:09:26.535Z`:
ISO 8601 internet date-time strings with fractional seconds.
The client converts them to `Date` values
and treats any string in another format as invalid.

Declare:

```swift
func parseTimestamp(_ string: String) -> Date?
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation

func parseTimestamp(_ string: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: string)
}
```

## control-logger-privacy

- Framework: os
- Source: control
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/os/logger>, <https://sosumi.ai/documentation/os/oslogprivacy/private>

Control case. Logger and OSLogPrivacy have been available since macOS 11. os_log(_:log:type:_:) takes an OSLog, not a Logger.

### task.md

````markdown
# Log a sign-in without exposing the user name

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: os (unified logging)

An app logs each sign-in at the informational level
with the message `Signed in: ` followed by the user name.
The user name must not appear in logs that are collected from customer devices:
mark the interpolated value as private.

Declare:

```swift
func logSignIn(user: String, to logger: Logger)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import os

func logSignIn(user: String, to logger: Logger) {
    logger.info("Signed in: \(user, privacy: .private)")
}
```

## control-sha256-hex

- Framework: CryptoKit
- Source: control
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/cryptokit/sha256>, <https://sosumi.ai/documentation/cryptokit/hashfunction/hash(data:)>

Control case. SHA256.hash(data:) has been available since macOS 10.15. SHA256Digest is a Sequence of UInt8 and has no hexadecimal string property.

### task.md

````markdown
# Compute a SHA-256 checksum as hexadecimal text

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: CryptoKit

A download manager verifies files against published SHA-256 checksums,
which are lowercase hexadecimal strings of 64 characters.

Declare:

```swift
func sha256Hex(of data: Data) -> String
```

Return the SHA-256 digest of `data` as a lowercase hexadecimal string.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import CryptoKit
import Foundation

func sha256Hex(of data: Data) -> String {
    SHA256.hash(data: data)
        .map { String(format: "%02x", $0) }
        .joined()
}
```

## control-urlsession-status

- Framework: Foundation
- Source: control
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundation/urlsession/data(from:delegate:)>, <https://sosumi.ai/documentation/foundation/httpurlresponse/statuscode>

Control case. URLSession.data(from:delegate:) has been available since macOS 12. data(for:delegate:) takes a URLRequest, not a URL.

### task.md

````markdown
# Fetch the HTTP status of a URL

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation

A link checker loads each URL with the shared URL session,
using Swift concurrency, and records the HTTP status code.
Responses that are not HTTP responses have no status code.

Declare:

```swift
func statusCode(of url: URL) async throws -> Int?
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation

func statusCode(of url: URL) async throws -> Int? {
    let (_, response) = try await URLSession.shared.data(from: url)
    return (response as? HTTPURLResponse)?.statusCode
}
```

## coredata-remote-change-message

- Framework: CoreData
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/coredata/nspersistentstorecoordinator/remotechangemessage>, <https://sosumi.ai/documentation/foundation/notificationcenter/messages(of:for:buffersize:)-4tof0>

The macOS 27 SDK adds NSPersistentStoreCoordinator.RemoteChangeMessage (a NotificationCenter.AsyncMessage) and the MessageIdentifier .remoteChange. NotificationCenter.messages(of:for:bufferSize:) is available from macOS 26. The older notifications(named:object:) yields Notification values.

### task.md

````markdown
# Receive remote store changes as typed messages

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Core Data

An app that syncs a Core Data store merges history
whenever another process changes the store.
It wants those remote-change events for one persistent store coordinator
as an asynchronous sequence of typed, concurrency-safe messages
instead of untyped notifications with user-info dictionaries.

Declare:

```swift
func remoteChanges(
    of coordinator: NSPersistentStoreCoordinator
) -> some AsyncSequence<NSPersistentStoreCoordinator.RemoteChangeMessage, Never>
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import CoreData

func remoteChanges(
    of coordinator: NSPersistentStoreCoordinator
) -> some AsyncSequence<NSPersistentStoreCoordinator.RemoteChangeMessage, Never> {
    NotificationCenter.default.messages(of: coordinator, for: .remoteChange)
}
```

## cryptokit-one-time-kem

- Framework: CryptoKit
- Source: sdk-diff
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/cryptokit/mlkem768/onetimeprivatekey>, <https://sosumi.ai/documentation/cryptokit/mlkem768/privatekey>

The macOS 27 SDK adds MLKEM768.OneTimePrivateKey, a noncopyable key with a consuming decapsulate(_:). MLKEM768.PrivateKey is available from macOS 26.0. At a macOS 26.0 deployment target, the one-time key needs #available(macOS 27.0, *).

### task.md

````markdown
# Decapsulate a post-quantum key exactly once

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: CryptoKit

A messaging app sets up a session key with ML-KEM-768.
It generates a private key, gives the public key to a peer,
receives the peer's encapsulated ciphertext, and decapsulates it.
On systems that offer it, the app uses a private key
that the type system lets the app decapsulate only once.
On older systems in the deployment range, it uses an ordinary ML-KEM-768 private key.

Declare:

```swift
func establishSessionKey(
    exchange: (MLKEM768.PublicKey) throws -> Data
) throws -> SymmetricKey
```

`exchange` sends the public key to the peer and returns the peer's encapsulated ciphertext.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import CryptoKit
import Foundation

func establishSessionKey(
    exchange: (MLKEM768.PublicKey) throws -> Data
) throws -> SymmetricKey {
    if #available(macOS 27.0, *) {
        let privateKey = try MLKEM768.OneTimePrivateKey()
        let ciphertext = try exchange(privateKey.publicKey)
        return try privateKey.decapsulate(ciphertext)
    } else {
        let privateKey = try MLKEM768.PrivateKey()
        let ciphertext = try exchange(privateKey.publicKey)
        return try privateKey.decapsulate(ciphertext)
    }
}
```

## fm-context-size-exceeded

- Framework: FoundationModels
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundationmodels/languagemodelerror>, <https://sosumi.ai/documentation/foundationmodels/languagemodelerror/contextsizeexceeded>

OS 27 adds LanguageModelError.contextSizeExceeded(ContextSizeExceeded), whose payload has contextSize and tokenCount. LanguageModelSession.GenerationError.exceededContextWindowSize is deprecated in 27.0 and its Context has no size.

### task.md

````markdown
# Recognize a context overflow error

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels

When a FoundationModels request fails because the prompt and transcript
no longer fit in the model's context, an app wants to trim the conversation.
To decide how much to trim, it needs the context size that the error reports.

Declare:

```swift
func exceededContextSize(_ error: any Error) -> Int?
```

Return the context size from the error when the error is a context overflow
reported by FoundationModels, and `nil` for any other error.
Use the current API, without deprecation warnings.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import FoundationModels

func exceededContextSize(_ error: any Error) -> Int? {
    guard case .contextSizeExceeded(let details)? = error as? LanguageModelError else {
        return nil
    }
    return details.contextSize
}
```

## fm-custom-language-model

- Framework: FoundationModels
- Source: failure
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundationmodels/languagemodel>, <https://sosumi.ai/documentation/foundationmodels/languagemodelexecutor>, <https://sosumi.ai/documentation/foundationmodels/languagemodelexecutorgenerationchannel>

FoundationModels 27 adds a public LanguageModel protocol. A conforming type names an Executor (LanguageModelExecutor) and supplies capabilities and executorConfiguration; the executor streams events into a LanguageModelExecutorGenerationChannel. Models without knowledge of OS 27 invent a request/response method.

### task.md

````markdown
# Plug a custom model into a language model session

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels

A test suite needs a fake language model that it can pass to
`LanguageModelSession(model:)` in place of the system model.
The fake model has no special capabilities and needs no configuration.
Whatever the request, it responds with the text `"Hello"`,
which counts as one token.

Declare:

```swift
struct EchoModel {          // conforms to the FoundationModels language model protocol
    init()
}

struct EchoExecutor {       // the type that generates EchoModel's responses
}
```

`EchoExecutor` must be the type that the framework uses
to run requests for `EchoModel`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import FoundationModels

struct EchoModel: LanguageModel {
    typealias Executor = EchoExecutor

    init() {}

    var capabilities: LanguageModelCapabilities {
        LanguageModelCapabilities([])
    }

    var executorConfiguration: EchoExecutor.Configuration {
        EchoExecutor.Configuration()
    }
}

struct EchoExecutor: LanguageModelExecutor {
    struct Configuration: Hashable, Sendable {}

    init(configuration: Configuration) throws {}

    nonisolated(nonsending) func respond(
        to request: LanguageModelExecutorGenerationRequest,
        model: EchoModel,
        streamingInto channel: LanguageModelExecutorGenerationChannel
    ) async throws {
        await channel.send(.response(action: .appendText("Hello", tokenCount: 1)))
    }
}
```

## fm-image-attachment

- Framework: FoundationModels
- Source: failure
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundationmodels/transcript/segment/attachment(_:)>, <https://sosumi.ai/documentation/foundationmodels/transcript/attachmentsegment>, <https://sosumi.ai/documentation/foundationmodels/transcript/imageattachment>, <https://sosumi.ai/documentation/foundationmodels/languagemodelcapabilities/capability/vision>

On OS 27, Transcript.Segment has case attachment(Transcript.AttachmentSegment), whose content is Transcript.Attachment.image(Transcript.ImageAttachment). The recorded claim said the model reports supportsImageInput; the SDK has no such symbol. A model reports image support through capabilities.contains(.vision), so the case uses that instead.

### task.md

````markdown
# Attach an image to a prompt when the model can see images

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels

An app builds transcript entries by hand.
When the user adds a picture, the app wants a transcript segment
that carries the image to the on-device model.
Some models cannot take image input;
for those, the function returns `nil` so that the app can fall back to text.

Declare:

```swift
func imageSegment(for image: CGImage, model: SystemLanguageModel) -> Transcript.Segment?
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import CoreGraphics
import FoundationModels

func imageSegment(for image: CGImage, model: SystemLanguageModel) -> Transcript.Segment? {
    guard model.capabilities.contains(.vision) else {
        return nil
    }
    let attachment = Transcript.AttachmentSegment(
        content: .image(Transcript.ImageAttachment(image))
    )
    return .attachment(attachment)
}
```

## fm-session-property-sendable

- Framework: FoundationModels
- Source: failure
- Target: `arm64-apple-macos27.0`
- Compiler flags: `-swift-version 6`
- Documentation: <https://sosumi.ai/documentation/foundationmodels/languagemodelsession/sessionproperty>

LanguageModelSession.SessionProperty conforms to Sendable only where Value: Sendable (FoundationModels.swiftinterface, MacOSX27.0.sdk). Apple's documentation data lists the conformance without the condition. An unconditional Sendable conformance on a generic wrapper fails in Swift 6 mode. Swift 5 mode does not diagnose the missing conformance, so this case needs -swift-version 6.

### task.md

````markdown
# Share a session property across tasks

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: FoundationModels
- Language mode: Swift 6

An app keeps per-session state in a FoundationModels language model session,
using a key path into the session's property values.
Write a small wrapper that reads and writes one such session property.
Tasks pass the wrapper to each other,
so it must be `Sendable` whenever its value type is `Sendable`.
It must also work, without being `Sendable`,
for value types that are not `Sendable`.

Declare:

```swift
struct SessionSetting<Value> {
    init(_ keyPath: ReferenceWritableKeyPath<SessionPropertyValues, Value>)
    var value: Value { get nonmutating set }
}
```

`value` reads and writes the session property at `keyPath`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import FoundationModels

struct SessionSetting<Value> {
    private let property: LanguageModelSession.SessionProperty<Value>

    init(_ keyPath: ReferenceWritableKeyPath<SessionPropertyValues, Value>) {
        property = LanguageModelSession.SessionProperty(keyPath)
    }

    var value: Value {
        get { property.wrappedValue }
        nonmutating set { property.wrappedValue = newValue }
    }
}

extension SessionSetting: Sendable where Value: Sendable {}
```

## fm-token-budget

- Framework: FoundationModels
- Source: failure
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/foundationmodels/systemlanguagemodel/contextsize>, <https://sosumi.ai/documentation/foundationmodels/systemlanguagemodel/tokencount(for:)>

SystemLanguageModel.contextSize is @backDeployed(before: macOS 26.4) from macOS 26.0, so it needs no availability check at a macOS 26.0 deployment target. SystemLanguageModel.tokenCount(for:) is available from macOS 26.4 only and needs #available. Both are unavailable on tvOS and watchOS; this macOS case cannot test that part of the claim. Sosumi's tokenCount(for:) page documents only the Instructions overload, with macOS 26.4 availability; the overload that takes transcript entries has no page of its own.

### task.md

````markdown
# Report how much context a session has left

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: FoundationModels

Before it sends a long prompt, an app checks how many tokens remain
in the on-device model's context window
after the conversation that a session already holds.
The app supports every macOS version from its deployment target.
On a system that cannot count tokens, the function returns `nil`.

Declare:

```swift
func remainingContext(
    for session: LanguageModelSession,
    model: SystemLanguageModel
) async throws -> Int?
```

The result is the model's context size
minus the number of tokens in the session's transcript.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import FoundationModels

func remainingContext(
    for session: LanguageModelSession,
    model: SystemLanguageModel
) async throws -> Int? {
    guard #available(macOS 26.4, *) else {
        return nil
    }
    let used = try await model.tokenCount(for: session.transcript)
    return model.contextSize - used
}
```

## foundation-predicate-all

- Framework: Foundation
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundation/predicate/init(all:)>

The macOS 27 SDK adds Predicate.init(all:) and Predicate.init(any:), which combine a collection of predicates. Before that, an answer can fold the filters with #Predicate and evaluate(_:), which also passes. The #Predicate macro rejects closures and try? inside its body.

### task.md

````markdown
# Combine a list of filters into one predicate

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation

A product search screen lets the user add any number of filters.
Each filter is a Foundation `Predicate`.
The app needs one predicate that matches a product
only when the product matches every filter in the list.
The check file declares the product type:

```swift
struct Product {
    var price: Double
    var inStock: Bool
}
```

Declare:

```swift
func matchingAll(_ filters: [Predicate<Product>]) -> Predicate<Product>
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation

func matchingAll(_ filters: [Predicate<Product>]) -> Predicate<Product> {
    Predicate(all: filters)
}
```

## foundation-progress-manager

- Framework: Foundation
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/foundation/subprogress>, <https://sosumi.ai/documentation/foundation/progressmanager>

The macOS 27 SDK adds ProgressManager, ProgressReporter, and the noncopyable Subprogress. A function receives a Subprogress, calls start(totalCount:) to get a ProgressManager, and reports work with complete(count:). Subprogress has none of NSProgress's unit-count properties.

### task.md

````markdown
# Report progress while importing files

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Foundation

An importer processes a list of files, one at a time.
The caller hands the importer its share of a parent progress
by using Foundation's Swift progress-reporting API for macOS 27,
and the importer reports one unit of work for each file it finishes.

Declare:

```swift
func importFiles(
    _ urls: [URL],
    progress: consuming Subprogress,
    importOne: (URL) async throws -> Void
) async throws
```

Call `importOne` for each URL in order,
and report completion of one unit after each call returns.
The total amount of work is the number of URLs.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation

func importFiles(
    _ urls: [URL],
    progress: consuming Subprogress,
    importOne: (URL) async throws -> Void
) async throws {
    let manager = progress.start(totalCount: urls.count)
    for url in urls {
        try await importOne(url)
        manager.complete(count: 1)
    }
}
```

## healthkit-earliest-authorized-date

- Framework: HealthKit
- Source: sdk-diff
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/healthkit/hkhealthstore/getearliestauthorizedsampledate(for:completion:)>, <https://sosumi.ai/documentation/healthkit/hkhealthstore/earliestpermittedsampledate()>

The macOS 27 SDK adds HKHealthStore.earliestAuthorizedSampleDate(for:), which returns [HKObjectType: Date]. At a macOS 26.0 deployment target it needs #available(macOS 27.0, *); the fallback is earliestPermittedSampleDate().

### task.md

````markdown
# Find the earliest health data the app may read

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: HealthKit

A health dashboard limits its date picker
to the range of samples that the app is allowed to read.
On systems that report the earliest authorized date for each data type,
the app asks for the date for the given type.
On older systems in the deployment range,
it uses the single earliest date that the health store permits for all samples.

Declare:

```swift
func earliestReadableDate(for type: HKObjectType, in store: HKHealthStore) async throws -> Date?
```

Return `nil` when the system reports no date for the type.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation
import HealthKit

func earliestReadableDate(for type: HKObjectType, in store: HKHealthStore) async throws -> Date? {
    if #available(macOS 27.0, *) {
        let dates = try await store.earliestAuthorizedSampleDate(for: [type])
        return dates[type]
    }
    return store.earliestPermittedSampleDate()
}
```

## imageplayground-creation-strategy

- Framework: ImagePlayground
- Source: sdk-diff
- Target: `arm64-apple-macos26.4`
- Documentation: <https://sosumi.ai/documentation/imageplayground/imageplaygroundoptions>, <https://sosumi.ai/documentation/imageplayground/imageplaygroundoptions/creationstrategy-swift.property>

ImagePlaygroundOptions is available from macOS 26.4. The macOS 27 SDK adds its creationStrategy property and the CreationStrategy enum (automatic, editExisting, generateNew). At a macOS 26.4 deployment target the property needs #available(macOS 27.0, *).

### task.md

````markdown
# Ask Image Playground to edit an existing image

- Platform: macOS
- Deployment target: macOS 26.4 (`arm64-apple-macos26.4`)
- Framework: ImagePlayground

A photo app opens Image Playground with a source image
and passes it a set of Image Playground options.
On systems where the options can say how Image Playground creates images,
the app asks it to edit the existing image instead of generating a new one.
On older systems in the deployment range, it uses the default options.

Declare:

```swift
func editingOptions() -> ImagePlaygroundOptions
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import ImagePlayground

func editingOptions() -> ImagePlaygroundOptions {
    var options = ImagePlaygroundOptions()
    if #available(macOS 27.0, *) {
        options.creationStrategy = .editExisting
    }
    return options
}
```

## ios-appintents-execution-targets

- Framework: AppIntents
- Source: sdk-diff
- Target: `arm64-apple-ios27.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/appintents/appintent/allowedexecutiontargets>, <https://sosumi.ai/documentation/appintents/intentexecutiontargets>

The iOS 27 SDK adds AppIntent.allowedExecutionTargets and the IntentExecutionTargets option set (default, main, appIntentsExtension, widgetKitExtension). The check cannot see which targets an answer allows, because the protocol supplies a default; the required_symbols check rejects an answer that never sets allowedExecutionTargets.

### task.md

````markdown
# Run an App Intent only in the main app

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: AppIntents

A news app offers a Shortcuts action that refreshes the feed.
The refresh needs the app's in-memory caches,
so the system must run this intent only in the app's main process,
never in an App Intents extension or a widget extension.
The check file declares the feed store:

```swift
actor FeedStore {
    static let shared: FeedStore
    func refresh() async throws
}
```

The intent's title is `Refresh Feed`.
Running it refreshes the shared feed store and returns an empty result.

Declare:

```swift
struct RefreshFeedIntent: AppIntent {
    init()
    func perform() async throws -> some IntentResult
}
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import AppIntents

struct RefreshFeedIntent: AppIntent {
    static let title: LocalizedStringResource = "Refresh Feed"
    static let allowedExecutionTargets: IntentExecutionTargets = .main

    init() {}

    func perform() async throws -> some IntentResult {
        try await FeedStore.shared.refresh()
        return .result()
    }
}
```

## ios-nowplaying-media-commands

- Framework: NowPlaying
- Source: sdk-diff
- Target: `arm64-apple-ios27.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/nowplaying/mediacommand>, <https://sosumi.ai/documentation/nowplaying/mediacommand/skipforward(preferredintervals:_:)>

NowPlaying is a new framework in the iOS 27 SDK. MediaCommand has static factories such as play(_:), pause(_:), skipForward(preferredIntervals:_:), and skipBackward(preferredIntervals:_:). Before it, apps registered handlers on MPRemoteCommandCenter, whose commands are MPRemoteCommand objects.

### task.md

````markdown
# Offer playback controls with the NowPlaying framework

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: NowPlaying

A podcast app publishes its playback controls to the system
(Lock Screen, Control Center, headphones) with the NowPlaying framework.
It offers play, pause, skip forward by 30 seconds, and skip back by 15 seconds.
The check file declares the player:

```swift
@MainActor protocol AudioPlayer: AnyObject {
    func play() async throws
    func pause() async throws
    func skip(by seconds: TimeInterval) async throws  // negative values skip back
}
```

Each control calls the matching player method.
The skip controls pass the interval that the system requests.

Declare:

```swift
@MainActor
func transportCommands(for player: any AudioPlayer) -> [MediaCommand]
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation
import NowPlaying

@MainActor
func transportCommands(for player: any AudioPlayer) -> [MediaCommand] {
    [
        .play { try await player.play() },
        .pause { try await player.pause() },
        .skipForward(preferredIntervals: [30]) { interval in
            try await player.skip(by: interval)
        },
        .skipBackward(preferredIntervals: [15]) { interval in
            try await player.skip(by: -interval)
        },
    ]
}
```

## ios-photosui-picker-search

- Framework: PhotosUI
- Source: sdk-diff
- Target: `arm64-apple-ios27.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/photosui/phpickerconfiguration-swift.struct/searchtext>, <https://sosumi.ai/documentation/photosui/phpickersearchtext-swift.struct>

The iOS 27 SDK adds PHPickerConfiguration.searchText of type PHPickerSearchText?, created from a string or a UIPhotoSearchSuggestion.

### task.md

````markdown
# Open the photo picker with a search already filled in

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: PhotosUI

A travel journal app lets the user add photos to a trip.
It opens the system photo picker showing only images,
with the picker's search already filled in with the trip's destination,
so the user starts from matching photos.

Declare:

```swift
func photoPickerConfiguration(searchingFor destination: String) -> PHPickerConfiguration
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import PhotosUI

func photoPickerConfiguration(searchingFor destination: String) -> PHPickerConfiguration {
    var configuration = PHPickerConfiguration()
    configuration.filter = .images
    configuration.searchText = PHPickerSearchText(destination)
    return configuration
}
```

## ios-uikit-bar-minimization

- Framework: UIKit
- Source: sdk-diff
- Target: `arm64-apple-ios27.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/uikit/uinavigationitem/navigationbarminimization-1kj9z>, <https://sosumi.ai/documentation/uikit/uibarminimization-swift.struct>

The iOS 27 SDK adds UIBarMinimization (a Swift struct refined from the Objective-C class) with minimizationBehavior, safeAreaAdjustment, and restorationBehavior, and UINavigationItem.navigationBarMinimization. iOS 26 has UITabBarController.tabBarMinimizeBehavior but no navigation bar equivalent.

### task.md

````markdown
# Minimize the navigation bar while reading

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: UIKit

A reading app shows long articles in a navigation controller.
As the reader scrolls down through an article, the navigation bar minimizes
to give the text more room.
The bar comes back only when the reader scrolls back to the top of the article,
not as soon as the reader changes scroll direction.

Declare:

```swift
@MainActor
func configureReadingNavigationBar(for item: UINavigationItem)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import UIKit

@MainActor
func configureReadingNavigationBar(for item: UINavigationItem) {
    var minimization = UIBarMinimization()
    minimization.minimizationBehavior = .onScrollDown
    minimization.restorationBehavior = .atScrollEdge
    item.navigationBarMinimization = minimization
}
```

## ios-uikit-grammar-checking

- Framework: UIKit
- Source: sdk-diff
- Target: `arm64-apple-ios27.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/uikit/uitextinputtraits/grammarcheckingtype>, <https://sosumi.ai/documentation/uikit/uitextgrammarcheckingtype>

The iOS 27 SDK adds UITextGrammarCheckingType (default, no, yes) and the grammarCheckingType text input trait. NSTextView on macOS uses isGrammarCheckingEnabled, which UITextView does not have.

### task.md

````markdown
# Turn off writing corrections in a code editor

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: UIKit

A code snippet app edits source code in a text view.
Writing aids that help with prose get in the way of code,
so the text view turns off autocorrection, spell checking, grammar checking,
and smart quotes.

Declare:

```swift
@MainActor
func makeCodeTextView() -> UITextView
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import UIKit

@MainActor
func makeCodeTextView() -> UITextView {
    let textView = UITextView()
    textView.autocorrectionType = .no
    textView.spellCheckingType = .no
    textView.grammarCheckingType = .no
    textView.smartQuotesType = .no
    return textView
}
```

## ios-uikit-reduced-resource-usage

- Framework: UIKit
- Source: sdk-diff
- Target: `arm64-apple-ios26.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/uikit/uiapplication/systemprefersreducedresourceusage>, <https://sosumi.ai/documentation/foundation/processinfo/islowpowermodeenabled>

The iOS 27 SDK adds UIApplication.systemPrefersReducedResourceUsage, a matching trait, and a change notification. At an iOS 26.0 deployment target the property needs #available(iOS 27.0, *); the fallback is ProcessInfo.isLowPowerModeEnabled.

### task.md

````markdown
# Do less background work when the system asks for it

- Platform: iOS
- Deployment target: iOS 26.0 (`arm64-apple-ios26.0`)
- Framework: UIKit

A photo app runs optional background work, such as generating thumbnails ahead of time.
On iOS versions where the system reports that it prefers apps to reduce their resource usage,
the app follows that preference.
On older versions in the deployment range, it reduces work when Low Power Mode is on.

Declare:

```swift
@MainActor
func shouldReduceBackgroundWork() -> Bool
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import UIKit

@MainActor
func shouldReduceBackgroundWork() -> Bool {
    if #available(iOS 27.0, *) {
        return UIApplication.shared.systemPrefersReducedResourceUsage
    }
    return ProcessInfo.processInfo.isLowPowerModeEnabled
}
```

## ios-uikit-scene-closure-confirmation

- Framework: UIKit
- Source: sdk-diff
- Target: `arm64-apple-ios27.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/uikit/uiwindowscene/closureconfirmation>, <https://sosumi.ai/documentation/uikit/uisceneclosureconfirmation>

The iOS 27 SDK adds UISceneClosureConfirmation, created with init(title:message:actions:) from UIAlertAction values, and UIWindowScene.closureConfirmation. Both are unavailable on tvOS, watchOS, and visionOS.

### task.md

````markdown
# Confirm before closing a window with unsaved changes

- Platform: iOS
- Deployment target: iOS 27.0 (`arm64-apple-ios27.0`)
- Framework: UIKit

On iPad, a document editor runs in several windows.
When a window has unsaved changes, closing it must first ask the user to confirm.
The confirmation has the title `Discard changes?`,
the message `This window has unsaved changes.`,
a destructive `Discard` action that calls `discard`,
and a cancel action titled `Keep Editing`.

Declare:

```swift
@MainActor
func requireClosureConfirmation(for scene: UIWindowScene, discard: @escaping () -> Void)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import UIKit

@MainActor
func requireClosureConfirmation(for scene: UIWindowScene, discard: @escaping () -> Void) {
    scene.closureConfirmation = UISceneClosureConfirmation(
        title: "Discard changes?",
        message: "This window has unsaved changes.",
        actions: [
            UIAlertAction(title: "Discard", style: .destructive) { _ in discard() },
            UIAlertAction(title: "Keep Editing", style: .cancel),
        ]
    )
}
```

## ios-uikit-sheet-placement

- Framework: UIKit
- Source: sdk-diff
- Target: `arm64-apple-ios26.0`
- Round: 2
- Documentation: <https://sosumi.ai/documentation/uikit/uisheetpresentationcontroller/preferredplacement>, <https://sosumi.ai/documentation/uikit/uisheetpresentationcontroller/placement>

The iOS 27 SDK adds UISheetPresentationController.Placement (automatic, leading, center, trailing) and preferredPlacement. At an iOS 26.0 deployment target the property needs #available(iOS 27.0, *).

### task.md

````markdown
# Show an inspector sheet on the trailing edge

- Platform: iOS
- Deployment target: iOS 26.0 (`arm64-apple-ios26.0`)
- Framework: UIKit

A drawing app shows its inspector as a sheet over the canvas.
On iOS versions that let an app choose where a sheet appears,
the inspector sheet appears on the trailing edge of the presenting view.
On older versions in the deployment range, it uses the default sheet placement.

Declare:

```swift
@MainActor
func presentInspector(_ inspector: UIViewController, from presenter: UIViewController)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import UIKit

@MainActor
func presentInspector(_ inspector: UIViewController, from presenter: UIViewController) {
    inspector.modalPresentationStyle = .pageSheet
    if #available(iOS 27.0, *), let sheet = inspector.sheetPresentationController {
        sheet.preferredPlacement = .trailing
    }
    presenter.present(inspector, animated: true)
}
```

## metrickit-diagnostic-reports

- Framework: MetricKit
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/metrickit/metricmanager>, <https://sosumi.ai/documentation/metrickit/metricmanager/diagnosticreports>, <https://sosumi.ai/documentation/metrickit/diagnosticresult>

The macOS 27 SDK adds a Swift MetricManager whose diagnosticReports property is an AsyncSequence of DiagnosticReport. Each report's result is a DiagnosticResult enum with crash(CrashDiagnostic), whose signal is Int?. The Objective-C MXMetricManager delivers MXDiagnosticPayload objects to subscribers.

### task.md

````markdown
# Read the next crash report with MetricKit

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: MetricKit

An app's support screen shows the signal of the most recent crash
that the system reports for the app.
It waits for the next diagnostic report from MetricKit's Swift manager type.

Declare:

```swift
func nextCrashSignal(from manager: MetricManager) async -> Int?
```

Wait for the next diagnostic report.
If it describes a crash, return the crash's signal number, which may be absent.
If it describes anything else, or no report arrives, return `nil`.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import MetricKit

func nextCrashSignal(from manager: MetricManager) async -> Int? {
    for await report in manager.diagnosticReports {
        if case .crash(let crash) = report.result {
            return crash.signal
        }
        return nil
    }
    return nil
}
```

## network-dtls

- Framework: Network
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/network/dtls>, <https://sosumi.ai/documentation/network/networkconnection>

NetworkConnection and its protocol stack builder arrived in macOS 26.0 with TLS, TCP, and UDP. The macOS 27 SDK adds the DTLS protocol for it, with init(_:) taking a UDP builder and version(min:max:). The older NWConnection API returns a different type.

### task.md

````markdown
# Open a DTLS connection with the structured Network API

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Network

A game client sends encrypted datagrams to its server.
It uses the Network framework's Swift-native connection type
with DTLS over UDP, and it refuses any protocol version older than DTLS 1.2.

Declare:

```swift
func makeGameConnection(host: String, port: NWEndpoint.Port) -> NetworkConnection<DTLS>
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Network

func makeGameConnection(host: String, port: NWEndpoint.Port) -> NetworkConnection<DTLS> {
    NetworkConnection(to: .hostPort(host: NWEndpoint.Host(host), port: port)) {
        DTLS {
            UDP()
        }
        .version(min: .DTLSv12)
    }
}
```

## observation-continuous

- Framework: Observation
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/observation/withcontinuousobservation(options:apply:)>, <https://sosumi.ai/documentation/observation/observationtracking/token>

The macOS 27 SDK adds withContinuousObservation(options:apply:), which returns a noncopyable ObservationTracking.Token, with ObservationTracking.Options and ObservationTracking.Event. The older withObservationTracking(_:onChange:) fires once and returns the apply closure's result, not a token.

### task.md

````markdown
# Observe a model value until the observer cancels

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Observation

An app shows a counter in several places.
A component outside SwiftUI wants a callback every time the counter's value changes,
for as long as it holds on to a value that it can later cancel.
The check file declares this observable type:

```swift
@MainActor @Observable final class Counter {
    var value: Int
    init(value: Int)
}
```

Declare:

```swift
@MainActor
func observeValue(
    of counter: Counter,
    onChange: @escaping @Sendable (Int) -> Void
) -> ObservationTracking.Token
```

Call `onChange` with the new value after each change to `counter.value`,
and keep observing until the caller cancels the returned token.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Observation

@MainActor
func observeValue(
    of counter: Counter,
    onChange: @escaping @Sendable (Int) -> Void
) -> ObservationTracking.Token {
    withContinuousObservation(options: [.didSet]) { event in
        guard event.kind == .didSet else {
            _ = counter.value
            return
        }
        onChange(counter.value)
    }
}
```

## speech-input-converter

- Framework: Speech
- Source: sdk-diff
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/speech/analyzerinputconverter>, <https://sosumi.ai/documentation/speech/analyzerinputconverter/converter(compatiblewith:)>, <https://sosumi.ai/documentation/speech/speechanalyzer/bestavailableaudioformat(compatiblewith:)>

The macOS 27 SDK adds AnalyzerInputConverter, created with converter(compatibleWith:) and used with convert(_:at:), which returns [AnalyzerInput]. At a macOS 26.0 deployment target it needs #available(macOS 27.0, *); the fallback converts with AVAudioConverter to SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith:).

### task.md

````markdown
# Convert recorded audio for speech transcription

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: Speech

A dictation feature records audio buffers in the microphone's native format
and feeds them to a `SpeechTranscriber`.
The transcriber needs input in a format that it supports,
so each buffer must be converted first.
On systems where the Speech framework can convert input buffers itself,
the app lets the framework do the conversion.
On older systems in the deployment range,
the app converts the buffer with `AVAudioConverter`
to the best audio format that the Speech framework reports for the transcriber,
and returns an empty array when no such format exists.

Declare:

```swift
func analyzerInputs(
    from buffer: AVAudioPCMBuffer,
    for transcriber: SpeechTranscriber
) async throws -> [AnalyzerInput]
```

The buffer has no timestamp.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import AVFoundation
import Speech

func analyzerInputs(
    from buffer: AVAudioPCMBuffer,
    for transcriber: SpeechTranscriber
) async throws -> [AnalyzerInput] {
    if #available(macOS 27.0, *) {
        let converter = try await AnalyzerInputConverter.converter(compatibleWith: [transcriber])
        return try converter.convert(buffer, at: nil)
    }
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]),
          let converter = AVAudioConverter(from: buffer.format, to: format),
          let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: buffer.frameCapacity)
    else {
        return []
    }
    try converter.convert(to: output, from: buffer)
    return [AnalyzerInput(buffer: output)]
}
```

## storekit-store-type

- Framework: StoreKit
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/storekit/apptransaction/storetype-swift.property>, <https://sosumi.ai/documentation/storekit/apptransaction/storetype-swift.struct>

The macOS 27 SDK adds AppTransaction.storeType of type AppTransaction.StoreType, with consumer, education, and enterprise. AppTransaction.shared returns VerificationResult<AppTransaction>. AppStore.Environment has no education value.

### task.md

````markdown
# Detect an education purchase of the app

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: StoreKit

Schools buy the app in volume through Apple's education channel.
When the app was obtained that way, it hides its in-app purchase upsell.
The decision uses the app's own App Store transaction,
and only a transaction that StoreKit has verified counts.

Declare:

```swift
func isEducationPurchase() async throws -> Bool
```

Return `true` only when the app transaction is verified
and shows that the app came from the education store.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import StoreKit

func isEducationPurchase() async throws -> Bool {
    let result = try await AppTransaction.shared
    guard case .verified(let transaction) = result else {
        return false
    }
    return transaction.storeType == .education
}
```

## swift-array-sendable

- Framework: Swift
- Source: failure
- Target: `arm64-apple-macos27.0`
- Compiler flags: `-swift-version 6`
- Documentation: <https://sosumi.ai/documentation/swift/array>

The standard library declares extension Array : @unchecked Sendable where Element : Sendable (Swift.swiftinterface, MacOSX27.0.sdk). Apple's documentation data puts other conditions on Array's conformances, such as Sendable when Element conforms to IntentValueConvertible. A generic type that stores [Item] can be Sendable only where Item is Sendable. Swift 5 mode does not diagnose the missing conformance, so this case needs -swift-version 6.

### task.md

````markdown
# Make a generic page of results sendable

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Swift standard library
- Language mode: Swift 6

A paginated API returns pages of items.
Pages of value types move between tasks,
so a page must be `Sendable` whenever its items are `Sendable`.
The same type also holds reference-type items on the main thread,
so it must remain usable, without being `Sendable`,
for items that are not `Sendable`.

Declare:

```swift
struct Page<Item> {
    var items: [Item]
    var nextCursor: String?
    init(items: [Item], nextCursor: String?)
}
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
struct Page<Item> {
    var items: [Item]
    var nextCursor: String?

    init(items: [Item], nextCursor: String?) {
        self.items = items
        self.nextCursor = nextCursor
    }
}

extension Page: Sendable where Item: Sendable {}
```

## swift-cancellation-shield

- Framework: Swift
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/swift/withtaskcancellationshield(operation:)-8zlgh>, <https://sosumi.ai/documentation/swift/task/hasactivecancellationshield>

The macOS 27 SDK adds withTaskCancellationShield(operation:) and Task.hasActiveCancellationShield, both @available(anyAppleOS 27.0, *). The stale answer guesses static members on Task. An unstructured Task { } that captures the non-escaping closure type-checks with Swift 6.4, so it cannot serve as the stale answer, but it does not meet the task: cancellation of the outer task does not reach it, and only the required_symbols check rejects it.

### task.md

````markdown
# Finish saving even when the task is cancelled

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Swift standard library (Swift Concurrency)

When the user closes a document window, the app cancels the task
that edits the document.
The final save must still run to completion:
code inside the save must not see the task as cancelled.
For logging, the app also wants to know whether the current code
runs inside such a protected region.

Declare:

```swift
func saveDraft(_ save: () async throws -> Void) async throws
func isProtectedFromCancellation() -> Bool
```

`saveDraft` awaits `save` within the current task
and keeps cancellation of that task from reaching `save`.
`isProtectedFromCancellation` returns `true`
when the current task's cancellation is hidden from the running code.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
func saveDraft(_ save: () async throws -> Void) async throws {
    try await withTaskCancellationShield {
        try await save()
    }
}

func isProtectedFromCancellation() -> Bool {
    Task.hasActiveCancellationShield
}
```

## swift-span-byte-order

- Framework: Swift
- Source: sdk-diff
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/swift/rawspan/load(frombyteoffset:as:_:)>, <https://sosumi.ai/documentation/swift/byteorder>, <https://sosumi.ai/documentation/swift/rawspan/unsafeloadunaligned(frombyteoffset:as:)>

The macOS 27 SDK adds the ByteOrder enum and RawSpan.load(fromByteOffset:as:_:) for fixed-width integers, both @available(anyAppleOS 27.0, *). At a macOS 26.0 deployment target the overload needs #available; the fallback loads with unsafeLoadUnaligned(fromByteOffset:as:) and converts with UInt32(bigEndian:).

### task.md

````markdown
# Read a big-endian length from a byte span

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: Swift standard library

A file parser reads a 32-bit big-endian length field
at a given offset in a `RawSpan`.
On systems whose standard library can load an integer
with an explicit byte order, the parser uses that.
On older systems in the deployment range,
it loads the raw bytes without alignment requirements and converts from big-endian itself.

Declare:

```swift
func readLength(in bytes: RawSpan, at offset: Int) -> UInt32
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
func readLength(in bytes: RawSpan, at offset: Int) -> UInt32 {
    if #available(macOS 27.0, *) {
        return bytes.load(fromByteOffset: offset, as: UInt32.self, .bigEndian)
    }
    return UInt32(bigEndian: unsafe bytes.unsafeLoadUnaligned(fromByteOffset: offset, as: UInt32.self))
}
```

## swift-unique-array

- Framework: Swift
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/swift/uniquearray>

The macOS 27 SDK adds UniqueArray<Element: ~Copyable>, a growable array that can hold noncopyable elements, with init(capacity:) and append(_:). Array cannot hold noncopyable elements.

### task.md

````markdown
# Issue a batch of noncopyable tickets

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Swift standard library

A ticketing system models each ticket as a noncopyable value,
so that no ticket can be duplicated by accident.
The check file declares the ticket type:

```swift
struct Ticket: ~Copyable {
    let number: Int
}
```

Declare:

```swift
func issueTickets(count: Int) -> UniqueArray<Ticket>
```

Return `count` tickets numbered from `0` through `count - 1`, in order.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
func issueTickets(count: Int) -> UniqueArray<Ticket> {
    var tickets = UniqueArray<Ticket>(capacity: count)
    for number in 0..<count {
        tickets.append(Ticket(number: number))
    }
    return tickets
}
```

## swiftdata-sectioned-results

- Framework: SwiftData
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/swiftdata/resultsobserver>, <https://sosumi.ai/documentation/swiftdata/sectionedresults>

The macOS 27 SDK adds ResultsObserver<Element, SectionTitle>, with throwing initializers that take sortBy:, sectionBy:, and modelContext:, and a sections property of type SectionedResults<Element, SectionTitle>? with sectionTitles.

### task.md

````markdown
# Group notes by folder outside SwiftUI

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: SwiftData

An AppKit sidebar lists notes grouped by folder,
sorted by title within each folder.
The sidebar is not a SwiftUI view, so it cannot use the `@Query` property wrapper.
It wants an object that keeps the fetched notes and their sections up to date
as the model context changes.
The check file declares the model:

```swift
@Model final class Note {
    var title: String
    var folder: String
    init(title: String, folder: String)
}
```

Declare:

```swift
@MainActor
func observeNotesByFolder(in context: ModelContext) throws -> ResultsObserver<Note, String>

@MainActor
func folderNames(in observer: ResultsObserver<Note, String>) -> [String]
```

`folderNames` returns the section titles in order,
or an empty array when the observer has no sections.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Foundation
import SwiftData

@MainActor
func observeNotesByFolder(in context: ModelContext) throws -> ResultsObserver<Note, String> {
    try ResultsObserver(
        sortBy: [SortDescriptor(\Note.title)],
        sectionBy: \Note.folder,
        modelContext: context
    )
}

@MainActor
func folderNames(in observer: ResultsObserver<Note, String>) -> [String] {
    observer.sections?.sectionTitles ?? []
}
```

## swiftui-tabs-picker

- Framework: SwiftUI
- Source: sdk-diff
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/swiftui/pickerstyle/tabs>, <https://sosumi.ai/documentation/swiftui/tabspickerstyle>

The macOS 27 SDK adds TabsPickerStyle and PickerStyle.tabs (iOS, macOS, tvOS, visionOS 27.0). At a macOS 26.0 deployment target, the style needs #available(macOS 27.0, *).

### task.md

````markdown
# Show a mode picker as tabs where the system supports it

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: SwiftUI

An inspector lets the user switch between three modes.
On macOS versions that have SwiftUI's tab-style picker,
the picker uses that style.
On older versions in the deployment range, it uses a segmented control.
The check file declares the mode type:

```swift
enum InspectorMode: String, CaseIterable, Identifiable {
    case layout, style, data
    var id: Self { self }
}
```

Declare:

```swift
struct ModePicker: View {
    init(selection: Binding<InspectorMode>)
}
```

The picker shows one item per mode, labeled with the mode's raw value.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import SwiftUI

struct ModePicker: View {
    @Binding var selection: InspectorMode

    init(selection: Binding<InspectorMode>) {
        _selection = selection
    }

    var body: some View {
        if #available(macOS 27.0, *) {
            picker.pickerStyle(.tabs)
        } else {
            picker.pickerStyle(.segmented)
        }
    }

    private var picker: some View {
        Picker("Mode", selection: $selection) {
            ForEach(InspectorMode.allCases) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
    }
}
```

## system-pipe-options

- Framework: System
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/system/filedescriptor/pipe(options:)>, <https://sosumi.ai/documentation/system/filedescriptor/pipeoptions>

The macOS 27 SDK adds FileDescriptor.pipe(options:) throws(Errno) and FileDescriptor.PipeOptions with closeOnExec, nonBlocking, and closeOnFork. The older FileDescriptor.pipe() throws an untyped error, so it cannot be called from a throws(Errno) function without handling the error.

### task.md

````markdown
# Create a pipe that child processes do not inherit

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: System

A process launcher creates a pipe to read a helper's output.
Both ends of the pipe must be closed automatically when the process executes
another program, so that unrelated children do not inherit them.
The launcher reports failures as `Errno` values with typed throws,
and it must set the flag atomically when the pipe is created.

Declare:

```swift
func makePrivatePipe() throws(Errno) -> (readEnd: FileDescriptor, writeEnd: FileDescriptor)
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import System

func makePrivatePipe() throws(Errno) -> (readEnd: FileDescriptor, writeEnd: FileDescriptor) {
    try FileDescriptor.pipe(options: .closeOnExec)
}
```

## uttype-markdown

- Framework: UniformTypeIdentifiers
- Source: sdk-diff
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/uniformtypeidentifiers/uttype-swift.struct/markdown>, <https://sosumi.ai/documentation/uniformtypeidentifiers/uttype-swift.struct/init(importedas:conformingto:)>

The macOS 27 SDK adds UTType.markdown. At a macOS 26.0 deployment target, it needs #available(macOS 27.0, *); the fallback is UTType(importedAs:).

### task.md

````markdown
# Accept Markdown files in an open panel

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: UniformTypeIdentifiers

A notes app opens Markdown files.
It needs the uniform type for Markdown to configure its open panel.
On macOS versions where the system declares a Markdown type constant,
the app uses that constant.
On older versions in the deployment range,
it uses the type with identifier `net.daringfireball.markdown`,
which the app imports in its Info.plist.

Declare:

```swift
func markdownType() -> UTType
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import UniformTypeIdentifiers

func markdownType() -> UTType {
    if #available(macOS 27.0, *) {
        return .markdown
    }
    return UTType(importedAs: "net.daringfireball.markdown")
}
```

## virtualization-secure-boot

- Framework: Virtualization
- Source: sdk-diff
- Target: `arm64-apple-macos27.0`
- Documentation: <https://sosumi.ai/documentation/virtualization/vzefivariablestore/issecurebootenabled>

The macOS 27 SDK adds VZEFIVariableStore.isSecureBootEnabled as a throwing property (get throws). Reading it without try does not compile.

### task.md

````markdown
# Show whether a virtual machine boots securely

- Platform: macOS
- Deployment target: macOS 27.0 (`arm64-apple-macos27.0`)
- Framework: Virtualization

A virtual machine manager shows a badge
when a Linux guest's EFI variable store has Secure Boot turned on.
If the manager cannot read that setting from the store,
it shows no badge at all.

Declare:

```swift
func secureBootBadge(for store: VZEFIVariableStore) -> Bool?
```

Return whether Secure Boot is enabled in `store`,
or `nil` when the setting cannot be read.

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import Virtualization

func secureBootBadge(for store: VZEFIVariableStore) -> Bool? {
    try? store.isSecureBootEnabled
}
```

## widgetkit-extra-large-portrait

- Framework: WidgetKit
- Source: sdk-diff
- Target: `arm64-apple-macos26.0`
- Documentation: <https://sosumi.ai/documentation/widgetkit/widgetfamily/systemextralargeportrait>

The macOS 27 SDK adds WidgetFamily.systemExtraLargePortrait (iOS and macOS 27.0, visionOS 26.0; unavailable on tvOS and watchOS). At a macOS 26.0 deployment target it needs #available(macOS 27.0, *).

### task.md

````markdown
# List the widget sizes that a widget supports

- Platform: macOS
- Deployment target: macOS 26.0 (`arm64-apple-macos26.0`)
- Framework: WidgetKit

A calendar widget supports the small, medium, and large system sizes.
On systems that offer the tall, extra-large portrait system size,
it supports that size too, listed last.
The widget configuration calls a helper to get the list.

Declare:

```swift
func calendarWidgetFamilies() -> [WidgetFamily]
```

Implement the behavior completely.
Do not use placeholder bodies such as `fatalError()`.
````

### reference.swift

```swift
import WidgetKit

func calendarWidgetFamilies() -> [WidgetFamily] {
    var families: [WidgetFamily] = [.systemSmall, .systemMedium, .systemLarge]
    if #available(macOS 27.0, *) {
        families.append(.systemExtraLargePortrait)
    }
    return families
}
```
