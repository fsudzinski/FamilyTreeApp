using FamilyTreeApp.Api.Dtos.Auth;
using FamilyTreeApp.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace FamilyTreeApp.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(UserManager<ApplicationUser> userManager, IConfiguration configuration) : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager = userManager;
    private readonly IConfiguration _configuration = configuration;

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);

        if (existingUser is not null)
        {
            return Conflict(new { Message = "Email is already registered." });
        }

        var user = new ApplicationUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        var token = GenerateJwtToken(user);
        SetAuthCookie(token);

        return CreatedAtAction(nameof(Me), null, new AuthUserDto
        {
            Id = user.Id,
            Email = user.Email
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);

        if (user is null || !await _userManager.CheckPasswordAsync(user, dto.Password))
        {
            return Unauthorized(new { Message = "Invalid email or password." });
        }

        var token = GenerateJwtToken(user);
        SetAuthCookie(token);

        return Ok(new AuthUserDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new AuthUserDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty
        });
    }

    private string GenerateJwtToken(ApplicationUser user)
    {
        var issuer = _configuration["Jwt:Issuer"] ?? string.Empty;
        var audience = _configuration["Jwt:Audience"] ?? string.Empty;
        var key = _configuration["Jwt:Key"] ?? string.Empty;

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private void SetAuthCookie(string token)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false, // true in production (HTTPS)
            SameSite = SameSiteMode.Lax,
            Expires = DateTime.UtcNow.AddHours(2)
        };

        Response.Cookies.Append("auth_token", token, cookieOptions);
    }
}
