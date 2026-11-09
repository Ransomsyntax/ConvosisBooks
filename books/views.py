import re
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction, IntegrityError, OperationalError
from django.http import JsonResponse, HttpResponseNotFound, HttpResponseServerError
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import Organization, UserProfile

def login_view(request, tab=None):
    if request.user.is_authenticated:
        return redirect(request.GET.get('next') or request.POST.get('next') or '/')

    active_tab = tab or request.POST.get('tab') or request.GET.get('tab') or 'signin'
    signin_error = None
    signup_error = None

    if request.method == 'POST':
        action = request.POST.get('action', 'signin')
        if action == 'signup':
            active_tab = 'signup'
            username = request.POST.get('signup_username', '').strip()
            name = request.POST.get('signup_name', '').strip()
            raw_email = request.POST.get('signup_email', '').strip()
            normalized_email = raw_email.lower()
            org_name = request.POST.get('signup_org', '').strip()
            password = request.POST.get('signup_password', '')
            confirm_password = request.POST.get('signup_confirm_password', '')

            if not normalized_email:
                signup_error = 'Email address is required.'
            elif '@' not in normalized_email or '.' not in normalized_email.split('@')[-1]:
                signup_error = 'Please enter a valid email address.'
            elif not username or not password:
                signup_error = 'Username and password are required.'
            elif len(username) < 3:
                signup_error = 'Username must be at least 3 characters long.'
            elif len(password) < 4:
                signup_error = 'Password must be at least 4 characters long.'
            elif password != confirm_password:
                signup_error = 'Passwords do not match.'
            elif User.objects.filter(email__iexact=normalized_email).exists() or UserProfile.objects.filter(normalized_email=normalized_email).exists():
                signup_error = 'An account with this email address already exists. Please log in instead.'
            elif User.objects.filter(username__iexact=username).exists():
                signup_error = f'Username "{username}" is already registered. Please sign in.'
            else:
                try:
                    with transaction.atomic():
                        # Final concurrency check inside transaction lock
                        if User.objects.filter(email__iexact=normalized_email).exists() or UserProfile.objects.filter(normalized_email=normalized_email).exists():
                            raise ValidationError('An account with this email address already exists. Please log in instead.')
                        if User.objects.filter(username__iexact=username).exists():
                            raise ValidationError(f'Username "{username}" is already registered. Please sign in.')

                        user = User.objects.create_user(
                            username=username,
                            email=normalized_email,
                            password=password,
                            first_name=name
                        )
                        company_title = org_name or (f"{name}'s Company" if name else f"{username}'s Company")
                        org = Organization.objects.create(
                            name=company_title,
                            owner=user,
                            email=normalized_email,
                            state='Kerala'
                        )
                        UserProfile.objects.create(
                            user=user,
                            role=UserProfile.ADMIN,
                            organization=org,
                            normalized_email=normalized_email
                        )
                        from . import services
                        services.ensure_default_accounts(org)
                        services.log_audit(user, 'signup', 'organization', org.pk, f'User {username} registered company {org.name}')
                        auth_login(request, user)
                        next_url = request.POST.get('next') or request.GET.get('next') or '/'
                        if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                            return JsonResponse({'status': 'ok', 'redirect': next_url})
                        return redirect(next_url)
                except (IntegrityError, ValidationError, ValueError, OperationalError) as err:
                    err_msg = str(err)
                    if 'already exists' in err_msg or 'unique' in err_msg.lower() or 'email' in err_msg.lower() or 'locked' in err_msg.lower():
                        signup_error = 'An account with this email address already exists. Please log in instead.'
                    else:
                        signup_error = err_msg or 'Registration failed. Please try again.'

            if signup_error:
                if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                    return JsonResponse({'error': signup_error, 'message': signup_error}, status=400)
                status_code = 400 if 'already exists' in signup_error else 200
                return render(request, 'registration/login.html', {
                    'tab': active_tab,
                    'signin_error': signin_error,
                    'signup_error': signup_error,
                    'signup_username': username,
                    'signup_name': name,
                    'signup_email': raw_email,
                    'signup_org': org_name,
                    'next': request.GET.get('next') or request.POST.get('next') or '/',
                }, status=status_code)
        else:
            active_tab = 'signin'
            username_or_email = request.POST.get('username', '').strip()
            password = request.POST.get('password', '')

            # Support login by username OR email address
            auth_username = username_or_email
            if '@' in username_or_email:
                matched_user = User.objects.filter(email__iexact=username_or_email.lower()).first()
                if matched_user:
                    auth_username = matched_user.username

            user = authenticate(request, username=auth_username, password=password)
            if user is not None:
                if user.is_active:
                    profile = getattr(user, 'profile', None)
                    if not profile:
                        if user.is_superuser:
                            org = Organization.objects.first()
                            UserProfile.objects.create(
                                user=user,
                                role=UserProfile.ADMIN,
                                organization=org,
                                normalized_email=(user.email or '').strip().lower()
                            )
                        else:
                            company_title = f"{user.get_full_name() or user.username}'s Company"
                            org = Organization.objects.create(
                                name=company_title,
                                owner=user,
                                email=(user.email or '').strip().lower() or f"{user.username}@company.com",
                                state='Kerala'
                            )
                            UserProfile.objects.create(
                                user=user,
                                role=UserProfile.ADMIN,
                                organization=org,
                                normalized_email=(user.email or '').strip().lower()
                            )
                            from . import services
                            services.ensure_default_accounts(org)
                    elif not profile.organization and not user.is_superuser:
                        company_title = f"{user.get_full_name() or user.username}'s Company"
                        org = Organization.objects.create(
                            name=company_title,
                            owner=user,
                            email=(user.email or '').strip().lower() or f"{user.username}@company.com",
                            state='Kerala'
                        )
                        profile.organization = org
                        if user.email:
                            profile.normalized_email = user.email.strip().lower()
                        profile.save(update_fields=['organization', 'normalized_email'])
                        from . import services
                        services.ensure_default_accounts(org)
                    auth_login(request, user)
                    next_url = request.POST.get('next') or request.GET.get('next') or '/'
                    return redirect(next_url)
                else:
                    signin_error = 'Your account has been deactivated. Please contact an administrator.'
            else:
                signin_error = 'Authentication failed: Incorrect username or password.'

    return render(request, 'registration/login.html', {
        'tab': active_tab,
        'signin_error': signin_error,
        'signup_error': signup_error,
        'next': request.GET.get('next') or request.POST.get('next') or '/',
    })

@login_required
@ensure_csrf_cookie
def index(request):
    return render(request, 'index.html')

def custom_404_view(request, exception=None):
    from django.http import JsonResponse, HttpResponseNotFound
    if request.path.startswith('/api/'):
        return JsonResponse({'error': 'Resource not found', 'message': 'The requested endpoint does not exist.'}, status=404)
    return HttpResponseNotFound('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>404 - Page Not Found</h1><p>The requested resource could not be found.</p><a href="/">Return to Home</a></body></html>')

def custom_500_view(request):
    from django.http import JsonResponse, HttpResponseServerError
    if request.path.startswith('/api/'):
        return JsonResponse({'error': 'Server error', 'message': 'An unexpected server error occurred.'}, status=500)
    return HttpResponseServerError('<!DOCTYPE html><html><head><title>500 Internal Error</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>500 - Server Error</h1><p>An unexpected server error occurred. Please contact system support.</p><a href="/">Return to Home</a></body></html>')
