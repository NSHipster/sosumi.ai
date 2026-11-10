import Network

func makeGameConnection(host: String, port: NWEndpoint.Port) -> NetworkConnection<DTLS> {
    NetworkConnection(to: .hostPort(host: NWEndpoint.Host(host), port: port)) {
        DTLS {
            UDP()
        }
        .version(min: .DTLSv12)
    }
}
