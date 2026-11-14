import re

from django.http import JsonResponse

from .models import AuditLog


class AdminAccessAuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        user = getattr(request, 'user', None)
        authenticated_user = user if user and user.is_authenticated else None
        is_admin_route = request.path.startswith('/admin/')
        is_platform_api_route = (
            request.path.startswith('/api/')
            and authenticated_user
            and authenticated_user.is_superuser
        )
        if is_admin_route or is_platform_api_route:
            AuditLog.objects.create(
                user=authenticated_user,
                username=authenticated_user.get_username() if authenticated_user else 'anonymous',
                action='admin_access',
                entity_type='DjangoAdmin' if is_admin_route else 'PlatformAdminAPI',
                summary=f'{request.method} {request.path[:300]}',
                status='success' if response.status_code < 400 else 'failure',
                ip_address=request.META.get('REMOTE_ADDR', '')[:50],
            )
        return response


class PlatformSuperuserApiPrivacyMiddleware:
    allowed_read_paths = {
        '/api/super-admin/overview/',
        '/api/super-admin/users/',
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        profile = getattr(user, 'profile', None) if user and user.is_authenticated else None
        is_tenant_member = bool(profile and getattr(profile, 'organization_id', None))
        if (
            request.path.startswith('/api/')
            and user
            and user.is_authenticated
            and user.is_superuser
            and not is_tenant_member
        ):
            allowed = (
                request.method == 'GET'
                and (
                    request.path in self.allowed_read_paths
                    or re.fullmatch(r'/api/super-admin/companies/\d+/', request.path)
                )
            )
            if not allowed:
                return JsonResponse(
                    {'error': 'Platform access is limited to account and subscription metadata.'},
                    status=403,
                )
        return self.get_response(request)
