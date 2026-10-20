// Vetor de teste da assinatura HMAC (D-04). Igual ao publicado em docs/API_CONTRATO.md; conferido com Python.
export const VECTOR = {
  secret: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
  body: {
    activityId: '3f2b6c1e-8d4a-4b7e-9c2f-1a5e6d7c8b90',
    deviceId: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
    fromSeq: 0,
    toSeq: 1,
    points: [
      { seq: 0, lat: -16.7097, lng: -49.2388, t: 1760000000000, accuracy: 5, speed: 3.1, altitude: 750, mocked: false, steps: 3 },
      { seq: 1, lat: -16.70975, lng: -49.23885, t: 1760000001000, accuracy: 4.5 },
    ],
  },
  canonical:
    '{"activityId":"3f2b6c1e-8d4a-4b7e-9c2f-1a5e6d7c8b90","deviceId":"9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a","fromSeq":0,"toSeq":1,"points":[{"seq":0,"lat":-16.7097,"lng":-49.2388,"t":1760000000000,"accuracy":5,"speed":3.1,"altitude":750,"mocked":false,"steps":3},{"seq":1,"lat":-16.70975,"lng":-49.23885,"t":1760000001000,"accuracy":4.5,"speed":null,"altitude":null,"mocked":null,"steps":null}]}',
  signature: '5457a0235e4794a5232a7c72cbbf84c7ef9d2a62aeac1a43996102fbd31dafcc',
};
