FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json EducationGamePlatform.csproj packages.lock.json ./
RUN dotnet restore EducationGamePlatform.csproj --locked-mode
COPY . .
RUN dotnet publish EducationGamePlatform.csproj -c Release --no-restore -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN mkdir -p /app/keys && chown "$APP_UID" /app/keys
COPY --from=build /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080
ENV DataProtection__KeysPath=/app/keys
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "EducationGamePlatform.dll"]
