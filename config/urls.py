from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from books import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/login/', views.login_view, name='login'),
    path('accounts/signup/', views.login_view, {'tab': 'signup'}, name='signup'),
    path('signup/', views.login_view, {'tab': 'signup'}, name='signup_direct'),
    path('login/', views.login_view, name='login_direct'),
    path('accounts/', include('django.contrib.auth.urls')),
    path('api/', include('books.urls')),
    path('', include('books.page_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = 'books.views.custom_404_view'
handler500 = 'books.views.custom_500_view'
