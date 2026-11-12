from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy
from django.urls import include, path
from books import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/login/', views.login_view, name='login'),
    path('accounts/signup/', views.login_view, {'tab': 'signup'}, name='signup'),
    path('signup/', views.login_view, {'tab': 'signup'}, name='signup_direct'),
    path('login/', views.login_view, name='login_direct'),
    path('accounts/password_reset/', views.RateLimitedPasswordResetView.as_view(), name='password_reset'),
    path('accounts/password_reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='registration/password_reset_done.html',
    ), name='password_reset_done'),
    path('accounts/reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='registration/password_reset_confirm.html',
        success_url=reverse_lazy('password_reset_complete'),
    ), name='password_reset_confirm'),
    path('accounts/reset/done/', auth_views.PasswordResetCompleteView.as_view(
        template_name='registration/password_reset_complete.html',
    ), name='password_reset_complete'),
    path('accounts/', include('django.contrib.auth.urls')),
    path('api/', include('books.urls')),
    path('', include('books.page_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = 'books.views.custom_404_view'
handler500 = 'books.views.custom_500_view'
