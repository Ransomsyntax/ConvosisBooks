from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
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
            email = request.POST.get('signup_email', '').strip()
            org_name = request.POST.get('signup_org', '').strip()
            password = request.POST.get('signup_password', '')
            confirm_password = request.POST.get('signup_confirm_password', '')

            if not username or not password:
                signup_error = 'Username and password are required.'
            elif len(username) < 3:
                signup_error = 'Username must be at least 3 characters long.'
            elif len(password) < 4:
                signup_error = 'Password must be at least 4 characters long.'
            elif password != confirm_password:
                signup_error = 'Passwords do not match.'
            elif User.objects.filter(username__iexact=username).exists():
                signup_error = f'Username "{username}" is already registered. Please sign in.'
            else:
                user = User.objects.create_user(username=username, email=email, password=password, first_name=name)
                company_title = org_name or (f"{name}'s Company" if name else f"{username}'s Company")
                org = Organization.objects.create(
                    name=company_title,
                    owner=user,
                    email=email or f"{username}@company.com",
                    state='Kerala'
                )
                UserProfile.objects.create(user=user, role=UserProfile.ADMIN, organization=org)
                from . import services
                services.ensure_default_accounts(org)
                services.log_audit(user, 'signup', 'organization', org.pk, f'User {username} registered company {org.name}')
                auth_login(request, user)
                next_url = request.POST.get('next') or request.GET.get('next') or '/'
                return redirect(next_url)
        else:
            active_tab = 'signin'
            username = request.POST.get('username', '').strip()
            password = request.POST.get('password', '')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                if user.is_active:
                    profile = getattr(user, 'profile', None)
                    if not profile:
                        if user.is_superuser:
                            org = Organization.objects.first()
                            UserProfile.objects.create(
                                user=user,
                                role=UserProfile.ADMIN,
                                organization=org
                            )
                        else:
                            company_title = f"{user.get_full_name() or user.username}'s Company"
                            org = Organization.objects.create(
                                name=company_title,
                                owner=user,
                                email=user.email or f"{user.username}@company.com",
                                state='Kerala'
                            )
                            UserProfile.objects.create(
                                user=user,
                                role=UserProfile.ADMIN,
                                organization=org
                            )
                            from . import services
                            services.ensure_default_accounts(org)
                    elif not profile.organization and not user.is_superuser:
                        company_title = f"{user.get_full_name() or user.username}'s Company"
                        org = Organization.objects.create(
                            name=company_title,
                            owner=user,
                            email=user.email or f"{user.username}@company.com",
                            state='Kerala'
                        )
                        profile.organization = org
                        profile.save(update_fields=['organization'])
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
