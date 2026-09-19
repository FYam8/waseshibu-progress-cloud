// Cloudflare Access identifiers are public configuration, not secrets.
// Keep them versioned so deployments cannot silently drift from the Access app.
export const ACCESS_CONFIG=Object.freeze({
  teamDomain:'https://fyam8.cloudflareaccess.com',
  audience:'a3aedeb57c70a1a92916bc9d6e642daa520319bcf77c876ace8e837df8cd0244',
});
