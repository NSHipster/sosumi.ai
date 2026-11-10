import Network

// Builds an NWConnection with DTLS parameters, as before the structured API.
func makeGameConnection(host: String, port: NWEndpoint.Port) -> NetworkConnection<DTLS> {
    let dtls = NWProtocolTLS.Options()
    sec_protocol_options_set_min_tls_protocol_version(dtls.securityProtocolOptions, .DTLSv12)
    let parameters = NWParameters(dtls: dtls)
    return NWConnection(host: NWEndpoint.Host(host), port: port, using: parameters)
}
