from rest_framework.test import APITestCase


class RestApiStackTests(APITestCase):
    def test_v2_health_endpoint_uses_drf(self):
        response = self.client.get('/api/v2/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_v2_health_endpoint_rejects_non_get_methods(self):
        response = self.client.post('/api/v2/health/')

        self.assertEqual(response.status_code, 405)
