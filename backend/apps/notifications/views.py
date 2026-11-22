from django.conf import settings
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, NotificationPreference, PushSubscription
from .services import is_web_push_configured


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "store",
            "title",
            "body",
            "title_en",
            "body_en",
            "link",
            "is_read",
            "created_at",
        ]


class NotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)


class MarkNotificationsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "Notifications marked as read."})


class PushConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(
            {
                "enabled": is_web_push_configured(),
                "vapid_public_key": getattr(settings, "VAPID_PUBLIC_KEY", "")
                if is_web_push_configured()
                else "",
            }
        )


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["push_enabled", "order_updates"]


class NotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response(NotificationPreferenceSerializer(pref).data)

    def patch(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        serializer = NotificationPreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PushSubscriptionKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=255)
    auth = serializers.CharField(max_length=255)


class PushSubscriptionRegisterSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=500)
    keys = PushSubscriptionKeysSerializer()
    language = serializers.ChoiceField(
        choices=PushSubscription.LanguageChoices.choices,
        default=PushSubscription.LanguageChoices.ARABIC,
        required=False,
    )

    def validate_endpoint(self, value: str) -> str:
        if not value.startswith("https://"):
            raise serializers.ValidationError("Push subscription endpoint must use HTTPS.")
        return value


class PushSubscriptionDeleteSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=500)


class PushSubscriptionReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ["id", "endpoint", "language", "is_active", "last_used_at", "created_at"]


class PushSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subs = PushSubscription.objects.filter(user=request.user, is_active=True)
        return Response(PushSubscriptionReadSerializer(subs, many=True).data)

    def post(self, request):
        serializer = PushSubscriptionRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:255]

        sub, _ = PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={
                "user": request.user,
                "p256dh": data["keys"]["p256dh"],
                "auth": data["keys"]["auth"],
                "language": data.get("language", "ar"),
                "user_agent": user_agent,
                "is_active": True,
            },
        )
        NotificationPreference.objects.get_or_create(
            user=request.user,
            defaults={"push_enabled": True, "order_updates": True},
        )
        return Response(
            PushSubscriptionReadSerializer(sub).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request):
        serializer = PushSubscriptionDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deleted_count, _ = PushSubscription.objects.filter(
            user=request.user,
            endpoint=serializer.validated_data["endpoint"],
        ).delete()
        return Response({"deleted": deleted_count > 0}, status=status.HTTP_200_OK)
