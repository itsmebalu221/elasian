export async function processFormSubmission(data) {
  // business logic lives here
  return {
    status: 'accepted',
    receivedAt: new Date().toISOString(),
    payload: data
  };
}
