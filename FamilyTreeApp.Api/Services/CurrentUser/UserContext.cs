using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace FamilyTreeApp.Api.Services.CurrentUser;

public class UserContext(IHttpContextAccessor httpContextAccessor) : IUserContext
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;

    public string UserId =>
        _httpContextAccessor.HttpContext?
            .User?
            .FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? throw new UnauthorizedAccessException();
}